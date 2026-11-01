package com.tripsplit.model;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "expense_splits")
@Getter @Setter @NoArgsConstructor
public class ExpenseSplit {
    @Id private UUID id;
    private UUID expenseId;
    private UUID tripId;
    private UUID memberId;
    private long sharePaise;
}
