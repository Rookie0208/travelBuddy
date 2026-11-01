package com.tripsplit.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

import java.util.Map;
import java.util.UUID;

/** Default when Firebase is not configured: only logs. */
@Service
@ConditionalOnProperty(name = "app.fcm.enabled", havingValue = "false", matchIfMissing = true)
public class LoggingPushService implements PushService {
    private static final Logger log = LoggerFactory.getLogger(LoggingPushService.class);

    @Override
    public void send(UUID userId, String title, String body, Map<String, String> data) {
        log.info("[PUSH disabled] to user {}: {} - {}", userId, title, body);
    }
}
