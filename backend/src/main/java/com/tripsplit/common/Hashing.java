package com.tripsplit.common;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.HexFormat;

public final class Hashing {
    private static final SecureRandom RNG = new SecureRandom();
    private Hashing() {}

    public static String sha256(String text) {
        try {
            byte[] d = MessageDigest.getInstance("SHA-256").digest(text.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(d);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    /** URL-safe random token. 32 bytes = 256 bits. */
    public static String randomToken(int bytes) {
        byte[] b = new byte[bytes];
        RNG.nextBytes(b);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(b);
    }

    public static String sixDigitCode() {
        return String.format("%06d", RNG.nextInt(1_000_000));
    }

    private static final String ALPHANUMERIC = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"; // 32 chars, readable

    /** Clean 6-character alphanumeric code for trip invites (e.g. TRP7K2). */
    public static String sixCharInviteCode() {
        StringBuilder sb = new StringBuilder(6);
        for (int i = 0; i < 6; i++) {
            sb.append(ALPHANUMERIC.charAt(RNG.nextInt(ALPHANUMERIC.length())));
        }
        return sb.toString();
    }
}
