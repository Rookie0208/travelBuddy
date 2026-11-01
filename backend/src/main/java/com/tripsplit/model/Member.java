package com.tripsplit.model;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "members")
@Getter @Setter @NoArgsConstructor
public class Member {
    @Id private UUID id;
    private UUID tripId;
    private UUID userId;          // null = guest (no app account)
    private String name;
    @Enumerated(EnumType.STRING) private Role role = Role.MEMBER;
    @Enumerated(EnumType.STRING) private MemberStatus status = MemberStatus.ACTIVE;
    private UUID claimMemberId;   // only for PENDING join requests
    private Instant leftAt;
    private Instant createdAt = Instant.now();

    public boolean isCurrent() { return status == MemberStatus.ACTIVE && leftAt == null; }
}
