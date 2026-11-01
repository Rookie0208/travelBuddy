package com.tripsplit.repo;

import com.tripsplit.model.*;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.*;

public interface ActivityRepository extends JpaRepository<Activity, UUID> {
    Page<Activity> findByTripIdOrderByCreatedAtDesc(UUID tripId, Pageable pageable);
    List<Activity> findByTripIdOrderByCreatedAtAsc(UUID tripId);
    boolean existsByActorId(UUID actorId);
}
