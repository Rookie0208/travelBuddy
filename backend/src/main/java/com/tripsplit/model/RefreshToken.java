package com.tripsplit.model;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "refresh_tokens")
@Getter @Setter @NoArgsConstructor
public class RefreshToken {
    @Id private UUID id;
    private UUID userId;
    private String tokenHash;
    private Instant expiresAt;
    private Instant createdAt = Instant.now();
}
