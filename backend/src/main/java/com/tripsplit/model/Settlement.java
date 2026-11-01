package com.tripsplit.model;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "settlements")
@Getter @Setter @NoArgsConstructor
public class Settlement {
    @Id private UUID id;
    private UUID tripId;
    private UUID fromMember;
    private UUID toMember;
    private long amountPaise;
    private UUID requestId;
    private UUID createdBy;
    private Instant createdAt = Instant.now();
}
