package com.tripsplit.service;

import com.tripsplit.model.Member;
import com.tripsplit.model.Notification;
import com.tripsplit.repo.MemberRepository;
import com.tripsplit.repo.NotificationRepository;
import com.tripsplit.web.Dtos.NotificationDto;
import com.tripsplit.web.Dtos.NotificationPage;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.util.*;

/**
 * In-app notifications (saved in the database) + push (after the transaction commits).
 * Only registered users get these. Guests have no account, so for them the trip history is the log.
 */
@Service
@RequiredArgsConstructor
public class NotificationService {
    private static final Logger log = LoggerFactory.getLogger(NotificationService.class);

    private final NotificationRepository repo;
    private final MemberRepository members;
    private final PushService push;

    /** Tell every registered, current member of the trip except one user (usually the actor). */
    @Transactional
    public void notifyTrip(UUID tripId, UUID exceptUserId, String title, String body) {
        List<UUID> targets = new ArrayList<>();
        for (Member m : members.findByTripId(tripId)) {
            if (m.isCurrent() && m.getUserId() != null && !m.getUserId().equals(exceptUserId)) {
                targets.add(m.getUserId());
            }
        }
        deliver(targets, tripId, title, body);
    }

    @Transactional
    public void notifyUser(UUID userId, UUID tripId, String title, String body) {
        deliver(List.of(userId), tripId, title, body);
    }

    private void deliver(List<UUID> userIds, UUID tripId, String title, String body) {
        for (UUID uid : userIds) {
            Notification n = new Notification();
            n.setId(UUID.randomUUID());
            n.setUserId(uid);
            n.setTripId(tripId);
            n.setMessage(body);
            repo.save(n);
        }
        Runnable sendAll = () -> {
            Map<String, String> data = tripId == null ? Map.of() : Map.of("tripId", tripId.toString());
            for (UUID uid : userIds) {
                try { push.send(uid, title, body, data); }
                catch (RuntimeException e) { log.warn("Push error: {}", e.getMessage()); }
            }
        };
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override public void afterCommit() { sendAll.run(); }
            });
        } else {
            sendAll.run();
        }
    }

    @Transactional(readOnly = true)
    public NotificationPage list(UUID userId, int page, int size) {
        Page<Notification> p = repo.findByUserIdOrderByCreatedAtDesc(userId,
                PageRequest.of(Math.max(page, 0), ActivityService.clamp(size)));
        return new NotificationPage(
                p.getContent().stream().map(n -> new NotificationDto(n.getId(), n.getTripId(), n.getMessage(),
                        n.isSeen(), n.getCreatedAt())).toList(),
                repo.countByUserIdAndSeenFalse(userId), p.getNumber(), p.getSize(), p.getTotalElements());
    }

    @Transactional
    public void markAllSeen(UUID userId) { repo.markAllSeen(userId); }
}
