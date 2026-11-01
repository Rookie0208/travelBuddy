package com.tripsplit.web;

import com.tripsplit.service.AuthService;
import com.tripsplit.web.Dtos.*;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/auth")
@RequiredArgsConstructor
public class AuthController {
    private final AuthService auth;

    @PostMapping("/register")
    @ResponseStatus(HttpStatus.CREATED)
    public MessageResponse register(@Valid @RequestBody RegisterRequest r) { return auth.register(r); }

    @PostMapping("/resend-code")
    public MessageResponse resend(@Valid @RequestBody EmailRequest r) { return auth.resendCode(r.email()); }

    @PostMapping("/verify-email")
    public AuthResponse verify(@Valid @RequestBody VerifyEmailRequest r) { return auth.verifyEmail(r); }

    @PostMapping("/login")
    public AuthResponse login(@Valid @RequestBody LoginRequest r) { return auth.login(r); }

    @PostMapping("/refresh")
    public AuthResponse refresh(@Valid @RequestBody RefreshRequest r) { return auth.refresh(r.refreshToken()); }

    @PostMapping("/logout")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void logout(@Valid @RequestBody RefreshRequest r) { auth.logout(r.refreshToken()); }
}
