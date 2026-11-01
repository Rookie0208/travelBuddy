package com.tripsplit.service;

import com.tripsplit.model.Activity;
import com.tripsplit.model.ActivityType;
import com.tripsplit.model.Member;
import com.tripsplit.repo.ActivityRepository;
import com.tripsplit.web.Dtos.ActivityDto;
import com.tripsplit.web.Dtos.ActivityPage;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class ActivityService {
    private final ActivityRepository repo;
    private final TripAccess access;

    /** Always called inside the same transaction as the action it describes. */
    @Transactional
    public Activity log(UUID tripId, UUID actorMemberId, ActivityType type, UUID expenseId, String message) {
        Activity a = new Activity();
        a.setId(UUID.randomUUID());
        a.setTripId(tripId);
        a.setActorId(actorMemberId);
        a.setType(type);
        a.setExpenseId(expenseId);
        a.setMessage(message);
        return repo.save(a);
    }

    @Transactional(readOnly = true)
    public ActivityPage list(UUID tripId, UUID userId, int page, int size) {
        access.member(tripId, userId);
        Map<UUID, Member> byId = access.membersById(tripId);
        Page<Activity> p = repo.findByTripIdOrderByCreatedAtDesc(tripId, PageRequest.of(Math.max(page, 0), clamp(size)));
        return new ActivityPage(p.getContent().stream().map(a -> toDto(a, byId)).toList(),
                p.getNumber(), p.getSize(), p.getTotalElements());
    }

    public ActivityDto toDto(Activity a, Map<UUID, Member> byId) {
        return new ActivityDto(a.getId(), a.getType(), TripAccess.nameOf(byId, a.getActorId()),
                a.getMessage(), a.getExpenseId(), a.getCreatedAt());
    }

    static int clamp(int size) { return Math.min(Math.max(size, 1), 100); }
}
