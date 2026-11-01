package com.tripsplit.service;

import com.tripsplit.common.ApiException;
import com.tripsplit.model.*;
import com.tripsplit.repo.MemberRepository;
import com.tripsplit.repo.TripRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

/** Every trip-related request goes through here: "is this user really in this trip?" */
@Service
@RequiredArgsConstructor
public class TripAccess {
    private final TripRepository trips;
    private final MemberRepository members;

    public Trip trip(UUID tripId) {
        return trips.findByIdAndDeletedAtIsNull(tripId).orElseThrow(() -> ApiException.notFound("Trip not found"));
    }

    /** Current (accepted, not left) member. Anyone else gets 404, so trip ids cannot be probed. */
    public Member member(UUID tripId, UUID userId) {
        trip(tripId);
        return members.findByTripIdAndUserId(tripId, userId)
                .filter(Member::isCurrent)
                .orElseThrow(() -> ApiException.notFound("Trip not found"));
    }

    public Member owner(UUID tripId, UUID userId) {
        Member m = member(tripId, userId);
        if (m.getRole() != Role.OWNER) throw ApiException.forbidden("OWNER_ONLY", "Only the trip owner can do this");
        return m;
    }

    /** Trip must not be settled (no new expenses / settlements). */
    public Trip openTrip(UUID tripId) {
        Trip t = trip(tripId);
        if (t.getStatus() == TripStatus.SETTLED) {
            throw ApiException.conflict("TRIP_SETTLED", "This trip is settled. Ask the owner to reopen it.");
        }
        return t;
    }

    public Map<UUID, Member> membersById(UUID tripId) {
        return members.findByTripId(tripId).stream().collect(Collectors.toMap(Member::getId, Function.identity()));
    }

    public static String nameOf(Map<UUID, Member> byId, UUID id) {
        Member m = id == null ? null : byId.get(id);
        return m == null ? "Former member" : m.getName();
    }
}
