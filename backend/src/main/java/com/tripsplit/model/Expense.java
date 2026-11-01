package com.tripsplit.model;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "expenses")
@Getter @Setter @NoArgsConstructor
public class Expense {
    @Id private UUID id;
    private UUID tripId;
    private UUID paidBy;
    private long amountPaise;
    private String title;
    private String category = "OTHER";
    private LocalDate expenseDate;
    private UUID requestId;
    @Version private Long version;
    private UUID createdBy;
    private Instant createdAt = Instant.now();
    private Instant updatedAt = Instant.now();
    private Instant deletedAt;
}
