package com.tripsplit.web;

import com.tripsplit.service.TripService;
import com.tripsplit.web.Dtos.*;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1")
@RequiredArgsConstructor
public class TripController {
    private final TripService trips;

    // ---- trips ----
    @GetMapping("/trips")
    public List<TripSummary> list(@AuthenticationPrincipal UUID userId) { return trips.list(userId); }

    @PostMapping("/trips")
    @ResponseStatus(HttpStatus.CREATED)
    public TripDetail create(@AuthenticationPrincipal UUID userId, @Valid @RequestBody CreateTripRequest r) {
        return trips.create(userId, r);
    }

    @GetMapping("/trips/{tripId}")
    public TripDetail get(@AuthenticationPrincipal UUID userId, @PathVariable UUID tripId) {
        return trips.detail(tripId, userId);
    }

    @PatchMapping("/trips/{tripId}")
    public TripDetail update(@AuthenticationPrincipal UUID userId, @PathVariable UUID tripId,
                             @Valid @RequestBody UpdateTripRequest r) {
        return trips.update(tripId, userId, r);
    }

    @DeleteMapping("/trips/{tripId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@AuthenticationPrincipal UUID userId, @PathVariable UUID tripId) {
        trips.delete(tripId, userId);
    }

    // ---- members ----
    @PostMapping("/trips/{tripId}/members")
    @ResponseStatus(HttpStatus.CREATED)
    public MemberDto addGuest(@AuthenticationPrincipal UUID userId, @PathVariable UUID tripId,
                              @Valid @RequestBody NameRequest r) {
        return trips.addGuest(tripId, userId, r.name());
    }

    @PatchMapping("/trips/{tripId}/members/{memberId}")
    public MemberDto rename(@AuthenticationPrincipal UUID userId, @PathVariable UUID tripId,
                            @PathVariable UUID memberId, @Valid @RequestBody NameRequest r) {
        return trips.rename(tripId, userId, memberId, r.name());
    }

    @DeleteMapping("/trips/{tripId}/members/{memberId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void remove(@AuthenticationPrincipal UUID userId, @PathVariable UUID tripId, @PathVariable UUID memberId) {
        trips.remove(tripId, userId, memberId);
    }

    @PostMapping("/trips/{tripId}/members/{memberId}/unlink")
    public MemberDto unlink(@AuthenticationPrincipal UUID userId, @PathVariable UUID tripId, @PathVariable UUID memberId) {
        return trips.unlink(tripId, userId, memberId);
    }

    @PostMapping("/trips/{tripId}/leave")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void leave(@AuthenticationPrincipal UUID userId, @PathVariable UUID tripId) {
        trips.leave(tripId, userId);
    }

    // ---- invite link + approval ----
    @PostMapping("/trips/{tripId}/invite-link/reset")
    public InviteCodeResponse reset(@AuthenticationPrincipal UUID userId, @PathVariable UUID tripId) {
        return trips.resetInvite(tripId, userId);
    }

    @GetMapping("/join/{code}")
    public JoinPreview preview(@AuthenticationPrincipal UUID userId, @PathVariable String code) {
        return trips.joinPreview(code, userId);
    }

    @PostMapping("/join/{code}")
    public JoinResult join(@AuthenticationPrincipal UUID userId, @PathVariable String code,
                           @RequestBody(required = false) JoinRequest r) {
        return trips.requestJoin(code, userId, r);
    }

    @PostMapping("/trips/{tripId}/join-requests/{memberId}/approve")
    public TripDetail approve(@AuthenticationPrincipal UUID userId, @PathVariable UUID tripId, @PathVariable UUID memberId) {
        return trips.approve(tripId, userId, memberId);
    }

    @PostMapping("/trips/{tripId}/join-requests/{memberId}/reject")
    public TripDetail reject(@AuthenticationPrincipal UUID userId, @PathVariable UUID tripId, @PathVariable UUID memberId) {
        return trips.reject(tripId, userId, memberId);
    }
}
