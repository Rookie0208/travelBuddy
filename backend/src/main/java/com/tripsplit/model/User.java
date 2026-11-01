package com.tripsplit.model;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "users")
@Getter @Setter @NoArgsConstructor
public class User {
    @Id private UUID id;
    private String name;
    private String email;
    private String passwordHash;
    private boolean emailVerified;
    private Instant createdAt = Instant.now();
}
