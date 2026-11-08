package com.tripsplit.service;

import com.tripsplit.common.ApiException;
import com.tripsplit.common.Hashing;
import com.tripsplit.model.*;
import com.tripsplit.repo.*;
import com.tripsplit.web.Dtos.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class TripService {
    private final TripRepository trips;
    private final MemberRepository members;
    private final UserRepository users;
    private final ExpenseRepository expenses;
    private final ExpenseSplitRepository splits;
    private final SettlementRepository settlements;
    private final ActivityRepository activities;
    private final ActivityService activity;
    private final NotificationService notifications;
    private final TripAccess access;

    // ---------------------------------------------------------------- trips

    @Transactional
    public TripDetail create(UUID userId, CreateTripRequest r) {
        User u = users.findById(userId).orElseThrow(() -> ApiException.unauthorized("NO_USER", "Please log in again"));
        String currency = (r.currency() == null || r.currency().isBlank()) ? "INR" : r.currency().trim().toUpperCase();
        if (!currency.matches("[A-Z]{3}")) throw ApiException.badRequest("INVALID_CURRENCY", "Currency must be a 3-letter code");
        checkDates(r.startDate(), r.endDate());

        Trip t = new Trip();
        t.setId(UUID.randomUUID());
        t.setName(r.name().trim());
        t.setDestination(blankToNull(r.destination()));
        t.setStartDate(r.startDate());
        t.setEndDate(r.endDate());
        t.setNotes(blankToNull(r.notes()));
        t.setCurrency(currency);
        t.setInviteCode(generateUniqueInviteCode());
        t.setCreatedBy(userId);
        trips.save(t);

        Member owner = newMember(t.getId(), userId, u.getName(), Role.OWNER, MemberStatus.ACTIVE);
        activity.log(t.getId(), owner.getId(), ActivityType.TRIP_CREATED, null,
                u.getName() + " created the trip \"" + t.getName() + "\".");
        if (r.guestNames() != null) {
            for (String name : r.guestNames()) {
                if (name == null || name.isBlank()) continue;
                Member g = newMember(t.getId(), null, name.trim(), Role.MEMBER, MemberStatus.ACTIVE);
                activity.log(t.getId(), owner.getId(), ActivityType.MEMBER_ADDED, null,
                        u.getName() + " added " + g.getName() + " to the trip.");
            }
        }
        return detail(t.getId(), userId);
    }

    @Transactional(readOnly = true)
    public List<TripSummary> list(UUID userId) {
        List<Member> mine = members.findByUserIdAndStatusAndLeftAtIsNull(userId, MemberStatus.ACTIVE);
        Map<UUID, Member> byTrip = mine.stream().collect(Collectors.toMap(Member::getTripId, m -> m));
        return trips.findAllById(byTrip.keySet()).stream()
                .filter(t -> t.getDeletedAt() == null)
                .sorted(Comparator.comparing(Trip::getCreatedAt).reversed())
                .map(t -> new TripSummary(t.getId(), t.getName(), t.getDestination(), t.getStartDate(), t.getEndDate(),
                        t.getCurrency(), t.getStatus(),
                        members.countByTripIdAndStatusAndLeftAtIsNull(t.getId(), MemberStatus.ACTIVE),
                        byTrip.get(t.getId()).getRole() == Role.OWNER,
                        expenses.totalForTrip(t.getId())))
                .toList();
    }

    @Transactional(readOnly = true)
    public TripDetail detail(UUID tripId, UUID userId) {
        Trip t = access.trip(tripId);
        Member me = access.member(tripId, userId);
        boolean owner = me.getRole() == Role.OWNER;
        List<Member> all = members.findByTripId(tripId);
        Map<UUID, Member> byId = all.stream().collect(Collectors.toMap(Member::getId, m -> m));

        List<MemberDto> memberDtos = all.stream()
                .filter(m -> m.getStatus() == MemberStatus.ACTIVE)
                .sorted(Comparator.comparing((Member m) -> m.getRole() != Role.OWNER).thenComparing(Member::getCreatedAt))
                .map(TripService::toDto).toList();

        List<PendingRequestDto> pending = !owner ? List.of() : all.stream()
                .filter(m -> m.getStatus() == MemberStatus.PENDING)
                .sorted(Comparator.comparing(Member::getCreatedAt))
                .map(m -> new PendingRequestDto(m.getId(), m.getName(), m.getClaimMemberId(),
                        m.getClaimMemberId() == null ? null : TripAccess.nameOf(byId, m.getClaimMemberId()),
                        m.getCreatedAt()))
                .toList();

        return new TripDetail(t.getId(), t.getName(), t.getDestination(), t.getStartDate(), t.getEndDate(), t.getNotes(),
                t.getCurrency(), t.getStatus(), me.getId(), me.getRole(),
                t.getInviteCode(), memberDtos, pending);
    }

    @Transactional
    public TripDetail update(UUID tripId, UUID userId, UpdateTripRequest r) {
        Member me = access.owner(tripId, userId);
        Trip t = access.trip(tripId);
        checkDates(r.startDate(), r.endDate());
        t.setName(r.name().trim());
        t.setDestination(blankToNull(r.destination()));
        t.setStartDate(r.startDate());
        t.setEndDate(r.endDate());
        t.setNotes(blankToNull(r.notes()));
        activity.log(tripId, me.getId(), ActivityType.TRIP_UPDATED, null, me.getName() + " updated the trip details.");
        return detail(tripId, userId);
    }

    @Transactional
    public void delete(UUID tripId, UUID userId) {
        access.owner(tripId, userId);
        access.trip(tripId).setDeletedAt(Instant.now());   // soft delete: data is kept
    }

    // ---------------------------------------------------------------- members

    @Transactional
    public MemberDto addGuest(UUID tripId, UUID userId, String name) {
        Member me = access.owner(tripId, userId);
        Member g = newMember(tripId, null, name.trim(), Role.MEMBER, MemberStatus.ACTIVE);
        activity.log(tripId, me.getId(), ActivityType.MEMBER_ADDED, null, me.getName() + " added " + g.getName() + " to the trip.");
        notifications.notifyTrip(tripId, userId, "Trip updated", me.getName() + " added " + g.getName() + " to the trip.");
        return toDto(g);
    }

    @Transactional
    public MemberDto rename(UUID tripId, UUID userId, UUID memberId, String newName) {
        Member me = access.owner(tripId, userId);
        Member m = currentMember(tripId, memberId);
        String old = m.getName();
        m.setName(newName.trim());
        activity.log(tripId, me.getId(), ActivityType.MEMBER_RENAMED, null,
                me.getName() + " renamed " + old + " to " + m.getName() + ".");
        return toDto(m);
    }

    @Transactional
    public void remove(UUID tripId, UUID userId, UUID memberId) {
        Member me = access.owner(tripId, userId);
        Member m = members.findByIdAndTripId(memberId, tripId).orElseThrow(() -> ApiException.notFound("Member not found"));
        if (m.getStatus() == MemberStatus.PENDING) { members.delete(m); return; }
        if (m.getRole() == Role.OWNER) throw ApiException.badRequest("CANNOT_REMOVE_OWNER", "The owner cannot be removed");
        UUID removedUser = m.getUserId();
        activity.log(tripId, me.getId(), ActivityType.MEMBER_REMOVED, null, me.getName() + " removed " + m.getName() + " from the trip.");
        detachOrDelete(m);
        if (removedUser != null) {
            notifications.notifyUser(removedUser, tripId, "Removed from trip", "You were removed from \"" + access.trip(tripId).getName() + "\".");
        }
    }

    @Transactional
    public void leave(UUID tripId, UUID userId) {
        Member me = access.member(tripId, userId);
        if (me.getRole() == Role.OWNER) {
            throw ApiException.conflict("OWNER_CANNOT_LEAVE", "The owner cannot leave. Delete the trip instead.");
        }
        activity.log(tripId, me.getId(), ActivityType.MEMBER_LEFT, null, me.getName() + " left the trip.");
        notifications.notifyTrip(tripId, userId, "Member left", me.getName() + " left the trip.");
        detachOrDelete(me);
    }

    /** Wrongly claimed name? The owner turns it back into a guest. History is untouched. */
    @Transactional
    public MemberDto unlink(UUID tripId, UUID userId, UUID memberId) {
        Member me = access.owner(tripId, userId);
        Member m = currentMember(tripId, memberId);
        if (m.getUserId() == null) throw ApiException.badRequest("NOT_LINKED", "This member is already a guest");
        if (m.getRole() == Role.OWNER) throw ApiException.badRequest("CANNOT_UNLINK_OWNER", "The owner cannot be unlinked");
        UUID oldUser = m.getUserId();
        m.setUserId(null);
        activity.log(tripId, me.getId(), ActivityType.MEMBER_UNLINKED, null,
                me.getName() + " unlinked the account from " + m.getName() + ".");
        notifications.notifyUser(oldUser, tripId, "Removed from trip", "You no longer have access to \"" + access.trip(tripId).getName() + "\".");
        return toDto(m);
    }

    @Transactional
    public InviteCodeResponse resetInvite(UUID tripId, UUID userId) {
        access.owner(tripId, userId);
        Trip t = access.trip(tripId);
        t.setInviteCode(generateUniqueInviteCode());
        return new InviteCodeResponse(t.getInviteCode());
    }

    // ---------------------------------------------------------------- join via invite link

    @Transactional(readOnly = true)
    public JoinPreview joinPreview(String code, UUID userId) {
        Trip t = tripByCode(code);
        List<Member> all = members.findByTripId(t.getId());
        String ownerName = all.stream().filter(m -> m.getRole() == Role.OWNER).map(Member::getName).findFirst().orElse("");
        String myStatus = all.stream().filter(m -> userId.equals(m.getUserId()))
                .map(m -> m.getStatus().name()).findFirst().orElse("NONE");
        List<MemberDto> claimable = all.stream()
                .filter(m -> m.isCurrent() && m.getUserId() == null)
                .sorted(Comparator.comparing(Member::getCreatedAt))
                .map(TripService::toDto).toList();
        return new JoinPreview(t.getId(), t.getName(), ownerName, myStatus, claimable);
    }

    /** Creates a PENDING request. Nothing is visible to the requester until the owner approves. */
    @Transactional
    public JoinResult requestJoin(String code, UUID userId, JoinRequest r) {
        Trip t = tripByCode(code);
        User u = users.findById(userId).orElseThrow(() -> ApiException.unauthorized("NO_USER", "Please log in again"));
        Optional<Member> existing = members.findByTripIdAndUserId(t.getId(), userId);
        if (existing.isPresent()) {
            if (existing.get().getStatus() == MemberStatus.ACTIVE) {
                throw ApiException.conflict("ALREADY_MEMBER", "You are already in this trip");
            }
            return new JoinResult("PENDING", t.getId());
        }
        String claimName = null;
        if (r != null && r.claimMemberId() != null) {
            Member target = members.findByIdAndTripId(r.claimMemberId(), t.getId())
                    .filter(m -> m.isCurrent() && m.getUserId() == null)
                    .orElseThrow(() -> ApiException.badRequest("CLAIM_UNAVAILABLE", "That name is not available to claim"));
            claimName = target.getName();
        }
        Member p = newMember(t.getId(), userId, u.getName(), Role.MEMBER, MemberStatus.PENDING);
        p.setClaimMemberId(r == null ? null : r.claimMemberId());

        Member owner = members.findByTripId(t.getId()).stream().filter(m -> m.getRole() == Role.OWNER).findFirst().orElseThrow();
        String msg = u.getName() + " wants to join \"" + t.getName() + "\"" + (claimName != null ? " as " + claimName : "") + ".";
        if (owner.getUserId() != null) notifications.notifyUser(owner.getUserId(), t.getId(), "Join request", msg);
        return new JoinResult("PENDING", t.getId());
    }

    @Transactional
    public TripDetail approve(UUID tripId, UUID ownerUserId, UUID pendingMemberId) {
        Member owner = access.owner(tripId, ownerUserId);
        Trip t = access.trip(tripId);
        Member p = members.findByIdAndTripId(pendingMemberId, tripId)
                .filter(m -> m.getStatus() == MemberStatus.PENDING)
                .orElseThrow(() -> ApiException.notFound("Join request not found"));
        UUID joinerUserId = p.getUserId();
        String message;
        if (p.getClaimMemberId() != null) {
            Member target = members.findByIdAndTripId(p.getClaimMemberId(), tripId).orElse(null);
            if (target == null || !target.isCurrent() || target.getUserId() != null) {
                throw ApiException.conflict("CLAIM_UNAVAILABLE", "That name is no longer available. Reject the request or ask them to ask again.");
            }
            members.delete(p);
            members.flush();                       // free the (trip, user) slot before linking
            target.setUserId(joinerUserId);        // history, shares and settlements stay with this member
            message = target.getName() + " joined the trip.";
        } else {
            p.setStatus(MemberStatus.ACTIVE);
            message = p.getName() + " joined the trip.";
        }
        activity.log(tripId, owner.getId(), ActivityType.MEMBER_JOINED, null, message);
        notifications.notifyTrip(tripId, joinerUserId, "New member", message);
        notifications.notifyUser(joinerUserId, tripId, "Request approved", "You can now see \"" + t.getName() + "\".");
        return detail(tripId, ownerUserId);
    }

    @Transactional
    public TripDetail reject(UUID tripId, UUID ownerUserId, UUID pendingMemberId) {
        access.owner(tripId, ownerUserId);
        Trip t = access.trip(tripId);
        Member p = members.findByIdAndTripId(pendingMemberId, tripId)
                .filter(m -> m.getStatus() == MemberStatus.PENDING)
                .orElseThrow(() -> ApiException.notFound("Join request not found"));
        UUID joiner = p.getUserId();
        members.delete(p);
        notifications.notifyUser(joiner, tripId, "Request declined", "Your request to join \"" + t.getName() + "\" was declined.");
        return detail(tripId, ownerUserId);
    }

    // ---------------------------------------------------------------- helpers

    private String generateUniqueInviteCode() {
        for (int i = 0; i < 20; i++) {
            String code = Hashing.sixCharInviteCode();
            if (trips.findByInviteCodeIgnoreCaseAndDeletedAtIsNull(code).isEmpty()) {
                return code;
            }
        }
        return Hashing.randomToken(8);
    }

    private Trip tripByCode(String code) {
        String clean = code == null ? "" : code.trim();
        return trips.findByInviteCodeIgnoreCaseAndDeletedAtIsNull(clean)
                .or(() -> trips.findByInviteCodeAndDeletedAtIsNull(clean))
                .orElseThrow(() -> ApiException.notFound("This invite link is invalid or has been reset"));
    }

    private Member currentMember(UUID tripId, UUID memberId) {
        return members.findByIdAndTripId(memberId, tripId).filter(Member::isCurrent)
                .orElseThrow(() -> ApiException.notFound("Member not found"));
    }

    private Member newMember(UUID tripId, UUID userId, String name, Role role, MemberStatus status) {
        Member m = new Member();
        m.setId(UUID.randomUUID());
        m.setTripId(tripId);
        m.setUserId(userId);
        m.setName(name);
        m.setRole(role);
        m.setStatus(status);
        return members.save(m);
    }

    /** Members with money history are kept (marked as left); members with none are deleted. */
    private void detachOrDelete(Member m) {
        boolean hasHistory = expenses.existsByPaidBy(m.getId()) || expenses.existsByCreatedBy(m.getId())
                || splits.existsByMemberId(m.getId())
                || settlements.existsByFromMemberOrToMember(m.getId(), m.getId())
                || activities.existsByActorId(m.getId());
        if (hasHistory) {
            m.setUserId(null);
            m.setLeftAt(Instant.now());
        } else {
            members.delete(m);
        }
    }

    private static void checkDates(java.time.LocalDate start, java.time.LocalDate end) {
        if (start != null && end != null && end.isBefore(start)) {
            throw ApiException.badRequest("INVALID_DATES", "End date cannot be before start date");
        }
    }

    private static String blankToNull(String s) { return s == null || s.isBlank() ? null : s.trim(); }

    static MemberDto toDto(Member m) {
        return new MemberDto(m.getId(), m.getName(), m.getUserId() == null, m.getRole(), m.getLeftAt() != null);
    }
}
