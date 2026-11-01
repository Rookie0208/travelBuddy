package com.tripsplit.service;

import com.tripsplit.common.ApiException;
import com.tripsplit.model.*;
import com.tripsplit.repo.*;
import com.tripsplit.web.Dtos.DeviceRequest;
import com.tripsplit.web.Dtos.UserDto;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class UserService {
    private final UserRepository users;
    private final DeviceTokenRepository devices;
    private final MemberRepository members;
    private final TripRepository trips;
    private final PasswordEncoder encoder;

    @Transactional(readOnly = true)
    public UserDto me(UUID userId) {
        User u = users.findById(userId).orElseThrow(() -> ApiException.unauthorized("NO_USER", "Please log in again"));
        return new UserDto(u.getId(), u.getName(), u.getEmail());
    }

    @Transactional
    public UserDto updateProfile(UUID userId, com.tripsplit.web.Dtos.UpdateProfileRequest r) {
        User u = users.findById(userId).orElseThrow(() -> ApiException.unauthorized("NO_USER", "Please log in again"));
        u.setName(r.name().trim());
        users.save(u);
        return new UserDto(u.getId(), u.getName(), u.getEmail());
    }

    @Transactional
    public void saveDevice(UUID userId, DeviceRequest r) {
        DeviceToken d = devices.findByFcmToken(r.fcmToken()).orElseGet(() -> {
            DeviceToken n = new DeviceToken();
            n.setId(UUID.randomUUID());
            n.setFcmToken(r.fcmToken());
            return n;
        });
        d.setUserId(userId);      // a phone token belongs to whoever logged in last
        d.setPlatform(r.platform());
        devices.save(d);
    }

    @Transactional
    public void removeDevice(UUID userId, String token) {
        devices.findByFcmToken(token).filter(d -> d.getUserId().equals(userId))
                .ifPresent(d -> devices.deleteByFcmToken(token));
    }

    /**
     * Deletes the account. The person stays in old trips as a plain name (financial history is kept),
     * but can no longer log in or see anything.
     */
    @Transactional
    public void deleteAccount(UUID userId, String password) {
        User u = users.findById(userId).orElseThrow(() -> ApiException.unauthorized("NO_USER", "Please log in again"));
        if (!encoder.matches(password, u.getPasswordHash())) {
            throw ApiException.forbidden("WRONG_PASSWORD", "Wrong password");
        }
        if (trips.existsByCreatedByAndDeletedAtIsNull(userId)) {
            throw ApiException.conflict("OWNS_TRIPS", "Delete the trips you own before deleting your account");
        }
        for (Member m : members.findByUserId(userId)) {
            if (m.getStatus() == MemberStatus.PENDING) {
                members.delete(m);
            } else {
                m.setUserId(null);
                if (m.getLeftAt() == null) m.setLeftAt(Instant.now());
            }
        }
        members.flush();
        users.delete(u);   // refresh tokens, codes, devices, notifications are removed by ON DELETE CASCADE
    }
}
