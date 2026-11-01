package com.tripsplit.common;

import java.util.*;

public final class SplitCalculator {
    private SplitCalculator() {}

    /**
     * Equal split in paise. The leftover paise (total % n) go one each to the first members
     * in a stable order (sorted by member id), so shares always add up to exactly the total.
     */
    public static Map<UUID, Long> equalSplit(long total, Collection<UUID> memberIds) {
        List<UUID> sorted = new ArrayList<>(new TreeSet<>(memberIds));
        int n = sorted.size();
        if (n == 0) throw new IllegalArgumentException("At least one member is required");
        long base = total / n;
        long remainder = total % n;
        Map<UUID, Long> result = new LinkedHashMap<>();
        for (int i = 0; i < n; i++) {
            result.put(sorted.get(i), base + (i < remainder ? 1 : 0));
        }
        return result;
    }
}
