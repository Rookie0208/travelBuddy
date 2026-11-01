package com.tripsplit.service;

import com.tripsplit.repo.EmailCodeRepository;
import com.tripsplit.repo.RefreshTokenRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Instant;

@Component
@RequiredArgsConstructor
public class CleanupJob {
    private final RefreshTokenRepository refreshTokens;
    private final EmailCodeRepository codes;

    @Scheduled(cron = "0 30 3 * * *")
    public void purgeExpired() {
        Instant now = Instant.now();
        refreshTokens.deleteByExpiresAtBefore(now);
        codes.deleteByExpiresAtBefore(now);
    }
}
