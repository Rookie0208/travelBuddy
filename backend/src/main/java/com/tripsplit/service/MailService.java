package com.tripsplit.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

@Service
public class MailService {
    private static final Logger log = LoggerFactory.getLogger(MailService.class);

    private final ObjectProvider<JavaMailSender> sender;
    private final boolean enabled;
    private final String from;

    public MailService(ObjectProvider<JavaMailSender> sender,
                       @Value("${app.mail.enabled}") boolean enabled,
                       @Value("${app.mail.from}") String from) {
        this.sender = sender;
        this.enabled = enabled;
        this.from = from;
    }

    public void sendVerificationCode(String to, String code) {
        JavaMailSender s = sender.getIfAvailable();
        if (!enabled || s == null) {
            log.warn("[DEV MAIL] Verification code for {} is {}", to, code);
            return;
        }
        SimpleMailMessage m = new SimpleMailMessage();
        m.setFrom(from);
        m.setTo(to);
        m.setSubject("Your TripSplit verification code");
        m.setText("Your verification code is " + code + ". It expires in 10 minutes.");
        s.send(m);
    }
}
