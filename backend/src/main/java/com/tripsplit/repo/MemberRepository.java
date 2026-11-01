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

public interface MemberRepository extends JpaRepository<Member, UUID> {
    List<Member> findByTripId(UUID tripId);
    List<Member> findByUserId(UUID userId);
    Optional<Member> findByTripIdAndUserId(UUID tripId, UUID userId);
    Optional<Member> findByIdAndTripId(UUID id, UUID tripId);
    List<Member> findByUserIdAndStatusAndLeftAtIsNull(UUID userId, MemberStatus status);
    long countByTripIdAndStatusAndLeftAtIsNull(UUID tripId, MemberStatus status);
}
