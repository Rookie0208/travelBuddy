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

public interface ExpenseRepository extends JpaRepository<Expense, UUID> {
    List<Expense> findByTripIdAndDeletedAtIsNullOrderByExpenseDateDescCreatedAtDesc(UUID tripId);
    List<Expense> findByTripIdOrderByExpenseDateAscCreatedAtAsc(UUID tripId);
    List<Expense> findByTripIdAndDeletedAtIsNull(UUID tripId);
    Optional<Expense> findByIdAndTripId(UUID id, UUID tripId);
    Optional<Expense> findByTripIdAndRequestId(UUID tripId, UUID requestId);
    boolean existsByPaidBy(UUID memberId);
    boolean existsByCreatedBy(UUID memberId);
    @Query("select coalesce(sum(e.amountPaise),0) from Expense e where e.tripId = :tripId and e.deletedAt is null")
    long totalForTrip(@Param("tripId") UUID tripId);
}
