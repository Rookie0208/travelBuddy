package com.tripsplit.model;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "email_codes")
@Getter @Setter @NoArgsConstructor
public class EmailCode {
    @Id private UUID id;
    private UUID userId;
    private String codeHash;
    private int attempts;
    private Instant expiresAt;
}
