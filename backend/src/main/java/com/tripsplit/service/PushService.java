package com.tripsplit.service;

import java.util.Map;
import java.util.UUID;

public interface PushService {
    void send(UUID userId, String title, String body, Map<String, String> data);
}
