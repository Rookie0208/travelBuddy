package com.tripsplit.web;

import com.tripsplit.service.NotificationService;
import com.tripsplit.service.UserService;
import com.tripsplit.web.Dtos.*;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1")
@RequiredArgsConstructor
public class UserController {
    private final UserService users;
    private final NotificationService notifications;

    @GetMapping("/me")
    public UserDto me(@AuthenticationPrincipal UUID userId) { return users.me(userId); }

    @PatchMapping("/me")
    public UserDto updateMe(@AuthenticationPrincipal UUID userId, @Valid @RequestBody UpdateProfileRequest r) {
        return users.updateProfile(userId, r);
    }

    @DeleteMapping("/me")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteMe(@AuthenticationPrincipal UUID userId, @Valid @RequestBody DeleteAccountRequest r) {
        users.deleteAccount(userId, r.password());
    }

    @PostMapping("/devices")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void saveDevice(@AuthenticationPrincipal UUID userId, @Valid @RequestBody DeviceRequest r) {
        users.saveDevice(userId, r);
    }

    @DeleteMapping("/devices")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void removeDevice(@AuthenticationPrincipal UUID userId, @RequestParam String token) {
        users.removeDevice(userId, token);
    }

    @GetMapping("/notifications")
    public NotificationPage notifications(@AuthenticationPrincipal UUID userId,
                                          @RequestParam(defaultValue = "0") int page,
                                          @RequestParam(defaultValue = "30") int size) {
        return notifications.list(userId, page, size);
    }

    @PostMapping("/notifications/read-all")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void readAll(@AuthenticationPrincipal UUID userId) { notifications.markAllSeen(userId); }
}
