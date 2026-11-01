package com.tripsplit.service;

import com.google.auth.oauth2.GoogleCredentials;
import com.google.firebase.FirebaseApp;
import com.google.firebase.FirebaseOptions;
import com.google.firebase.messaging.FirebaseMessaging;
import com.google.firebase.messaging.FirebaseMessagingException;
import com.google.firebase.messaging.Message;
import com.google.firebase.messaging.MessagingErrorCode;
import com.tripsplit.model.DeviceToken;
import com.tripsplit.repo.DeviceTokenRepository;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.Map;
import java.util.UUID;

/** Real push through Firebase Cloud Messaging. Enable with FCM_ENABLED=true and a service-account JSON. */
@Service
@ConditionalOnProperty(name = "app.fcm.enabled", havingValue = "true")
public class FcmPushService implements PushService {
    private static final Logger log = LoggerFactory.getLogger(FcmPushService.class);

    private final DeviceTokenRepository devices;
    private final String credentialsPath;

    public FcmPushService(DeviceTokenRepository devices, @Value("${app.fcm.credentials-path}") String credentialsPath) {
        this.devices = devices;
        this.credentialsPath = credentialsPath;
    }

    @PostConstruct
    void init() throws IOException {
        if (FirebaseApp.getApps().isEmpty()) {
            try (InputStream in = new FileInputStream(credentialsPath)) {
                FirebaseApp.initializeApp(FirebaseOptions.builder()
                        .setCredentials(GoogleCredentials.fromStream(in)).build());
            }
        }
    }

    @Override
    public void send(UUID userId, String title, String body, Map<String, String> data) {
        for (DeviceToken d : devices.findByUserId(userId)) {
            try {
                Message msg = Message.builder()
                        .setToken(d.getFcmToken())
                        .setNotification(com.google.firebase.messaging.Notification.builder()
                                .setTitle(title).setBody(body).build())
                        .putAllData(data)
                        .build();
                FirebaseMessaging.getInstance().send(msg);
            } catch (FirebaseMessagingException e) {
                if (e.getMessagingErrorCode() == MessagingErrorCode.UNREGISTERED) {
                    devices.deleteByFcmToken(d.getFcmToken());   // phone uninstalled the app
                } else {
                    log.warn("Push failed for user {}: {}", userId, e.getMessage());
                }
            } catch (RuntimeException e) {
                log.warn("Push failed for user {}: {}", userId, e.getMessage());
            }
        }
    }
}
