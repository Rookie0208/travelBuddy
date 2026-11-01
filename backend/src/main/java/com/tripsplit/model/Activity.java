package com.tripsplit.model;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "activities")
@Getter @Setter @NoArgsConstructor
public class Activity {
    @Id private UUID id;
    private UUID tripId;
    private UUID actorId;
    @Enumerated(EnumType.STRING) private ActivityType type;
    private UUID expenseId;
    private String message;
    private Instant createdAt = Instant.now();
}
