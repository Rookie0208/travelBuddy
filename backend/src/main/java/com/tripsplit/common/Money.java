package com.tripsplit.common;

import java.math.BigDecimal;

/** All money is whole paise (long). BigDecimal is used only to read what the user typed. */
public final class Money {
    private Money() {}

    /** "1200", "1200.5", "1200.50" -> paise. More than 2 decimals is rejected. */
    public static long parseToPaise(String text) {
        if (text == null || text.isBlank()) throw ApiException.badRequest("INVALID_AMOUNT", "Amount is required");
        try {
            BigDecimal paise = new BigDecimal(text.trim()).movePointRight(2);
            if (paise.stripTrailingZeros().scale() > 0) {
                throw ApiException.badRequest("INVALID_AMOUNT", "Amount can have at most 2 decimal places");
            }
            return paise.longValueExact();
        } catch (NumberFormatException | ArithmeticException e) {
            throw ApiException.badRequest("INVALID_AMOUNT", "Invalid amount");
        }
    }

    public static String plain(long paise) {
        return BigDecimal.valueOf(paise, 2).toPlainString();
    }

    public static String format(long paise, String currency) {
        String sign = paise < 0 ? "-" : "";
        long abs = Math.abs(paise);
        long whole = abs / 100;
        String digits = Long.toString(whole);
        boolean inr = "INR".equals(currency);
        String grouped;
        if (inr) {
            if (digits.length() <= 3) grouped = digits;
            else {
                String last3 = digits.substring(digits.length() - 3);
                String rest = digits.substring(0, digits.length() - 3).replaceAll("(\\d)(?=(\\d{2})+$)", "$1,");
                grouped = rest + "," + last3;
            }
        } else {
            grouped = digits.replaceAll("(\\d)(?=(\\d{3})+$)", "$1,");
        }
        return sign + symbol(currency) + grouped + String.format(".%02d", abs % 100);
    }

    private static String symbol(String c) {
        return switch (c) {
            case "INR" -> "₹";
            case "USD" -> "$";
            case "EUR" -> "€";
            case "GBP" -> "£";
            default -> c + " ";
        };
    }
}
