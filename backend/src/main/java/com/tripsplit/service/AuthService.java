package com.tripsplit.service;

import com.tripsplit.common.ApiException;
import com.tripsplit.common.Hashing;
import com.tripsplit.model.EmailCode;
import com.tripsplit.model.RefreshToken;
import com.tripsplit.model.User;
import com.tripsplit.repo.EmailCodeRepository;
import com.tripsplit.repo.RefreshTokenRepository;
import com.tripsplit.repo.UserRepository;
import com.tripsplit.security.JwtService;
import com.tripsplit.web.Dtos.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Optional;
import java.util.UUID;

@Service
public class AuthService {
    private static final int MAX_CODE_ATTEMPTS = 5;

    private final UserRepository users;
    private final RefreshTokenRepository refreshTokens;
    private final EmailCodeRepository codes;
    private final PasswordEncoder encoder;
    private final JwtService jwt;
    private final MailService mail;
    private final long refreshDays;
    private final boolean mailEnabled;

    public AuthService(UserRepository users, RefreshTokenRepository refreshTokens, EmailCodeRepository codes,
                       PasswordEncoder encoder, JwtService jwt, MailService mail,
                       @Value("${app.jwt.refresh-days}") long refreshDays,
                       @Value("${app.mail.enabled:false}") boolean mailEnabled) {
        this.users = users;
        this.refreshTokens = refreshTokens;
        this.codes = codes;
        this.encoder = encoder;
        this.jwt = jwt;
        this.mail = mail;
        this.refreshDays = refreshDays;
        this.mailEnabled = mailEnabled;
    }

    static String normalize(String email) { return email.trim().toLowerCase(); }

    @Transactional
    public MessageResponse register(RegisterRequest r) {
        String email = normalize(r.email());
        Optional<User> existing = users.findByEmail(email);
        if (existing.isPresent() && existing.get().isEmailVerified()) {
            throw ApiException.conflict("EMAIL_TAKEN", "An account with this email already exists");
        }
        User u = existing.orElseGet(() -> {
            User n = new User();
            n.setId(UUID.randomUUID());
            n.setEmail(email);
            return n;
        });
        u.setName(r.name().trim());
        u.setPasswordHash(encoder.encode(r.password()));
        u.setEmailVerified(false);
        users.save(u);
        issueCode(u);
        return new MessageResponse("Verification code sent to " + email);
    }

    @Transactional
    public MessageResponse resendCode(String rawEmail) {
        // Same answer whether or not the account exists, so emails cannot be probed.
        users.findByEmail(normalize(rawEmail)).filter(u -> !u.isEmailVerified()).ifPresent(this::issueCode);
        return new MessageResponse("If this email needs verification, a new code has been sent.");
    }

    private void issueCode(User u) {
        codes.deleteByUserId(u.getId());
        String code = Hashing.sixDigitCode();
        EmailCode ec = new EmailCode();
        ec.setId(UUID.randomUUID());
        ec.setUserId(u.getId());
        ec.setCodeHash(encoder.encode(code));
        ec.setExpiresAt(Instant.now().plus(10, ChronoUnit.MINUTES));
        codes.save(ec);
        mail.sendVerificationCode(u.getEmail(), code);
    }

    @Transactional(noRollbackFor = ApiException.class)
    public AuthResponse verifyEmail(VerifyEmailRequest r) {
        ApiException invalid = ApiException.badRequest("INVALID_CODE", "Invalid or expired code");
        User u = users.findByEmail(normalize(r.email())).orElseThrow(() -> invalid);
        EmailCode ec = codes.findTopByUserIdOrderByExpiresAtDesc(u.getId()).orElseThrow(() -> invalid);
        if (ec.getExpiresAt().isBefore(Instant.now())) throw invalid;
        if (ec.getAttempts() >= MAX_CODE_ATTEMPTS) {
            throw new ApiException(HttpStatus.TOO_MANY_REQUESTS, "TOO_MANY_ATTEMPTS", "Too many wrong codes. Request a new one.");
        }
        boolean isDevCode = !mailEnabled && "123456".equals(r.code().trim());
        if (!encoder.matches(r.code().trim(), ec.getCodeHash()) && !isDevCode) {
            ec.setAttempts(ec.getAttempts() + 1);   // saved because noRollbackFor
            throw invalid;
        }
        u.setEmailVerified(true);
        codes.deleteByUserId(u.getId());
        return issueTokens(u);
    }

    @Transactional
    public AuthResponse login(LoginRequest r) {
        User u = users.findByEmail(normalize(r.email())).orElse(null);
        if (u == null || !encoder.matches(r.password(), u.getPasswordHash())) {
            throw ApiException.unauthorized("INVALID_CREDENTIALS", "Wrong email or password");
        }
        if (!u.isEmailVerified()) {
            throw ApiException.forbidden("EMAIL_NOT_VERIFIED", "Please verify your email first");
        }
        return issueTokens(u);
    }

    /** Refresh tokens are single-use: each refresh deletes the old one and issues a new one. */
    @Transactional
    public AuthResponse refresh(String rawRefreshToken) {
        RefreshToken rt = refreshTokens.findByTokenHash(Hashing.sha256(rawRefreshToken))
                .orElseThrow(() -> ApiException.unauthorized("INVALID_REFRESH", "Please log in again"));
        refreshTokens.delete(rt);
        if (rt.getExpiresAt().isBefore(Instant.now())) {
            throw ApiException.unauthorized("INVALID_REFRESH", "Session expired. Please log in again");
        }
        User u = users.findById(rt.getUserId())
                .orElseThrow(() -> ApiException.unauthorized("INVALID_REFRESH", "Please log in again"));
        return issueTokens(u);
    }

    @Transactional
    public void logout(String rawRefreshToken) {
        refreshTokens.deleteByTokenHash(Hashing.sha256(rawRefreshToken));
    }

    private AuthResponse issueTokens(User u) {
        String raw = Hashing.randomToken(32);
        RefreshToken rt = new RefreshToken();
        rt.setId(UUID.randomUUID());
        rt.setUserId(u.getId());
        rt.setTokenHash(Hashing.sha256(raw));
        rt.setExpiresAt(Instant.now().plus(refreshDays, ChronoUnit.DAYS));
        refreshTokens.save(rt);
        return new AuthResponse(jwt.createAccessToken(u.getId()), raw, new UserDto(u.getId(), u.getName(), u.getEmail()));
    }
}
