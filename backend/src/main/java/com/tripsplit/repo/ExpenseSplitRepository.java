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

public interface ExpenseSplitRepository extends JpaRepository<ExpenseSplit, UUID> {
    List<ExpenseSplit> findByExpenseId(UUID expenseId);
    List<ExpenseSplit> findByExpenseIdIn(Collection<UUID> expenseIds);
    boolean existsByMemberId(UUID memberId);
    @Modifying(flushAutomatically = true)
    @Query("delete from ExpenseSplit s where s.expenseId = :expenseId")
    void deleteAllForExpense(@Param("expenseId") UUID expenseId);
}
