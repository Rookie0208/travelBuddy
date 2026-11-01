package com.tripsplit.model;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "trips")
@Getter @Setter @NoArgsConstructor
public class Trip {
    @Id private UUID id;
    private String name;
    private String destination;
    private LocalDate startDate;
    private LocalDate endDate;
    private String notes;
    private String currency = "INR";
    private String inviteCode;
    @Enumerated(EnumType.STRING) private TripStatus status = TripStatus.ACTIVE;
    private UUID createdBy;
    private Instant createdAt = Instant.now();
    private Instant deletedAt;
}
