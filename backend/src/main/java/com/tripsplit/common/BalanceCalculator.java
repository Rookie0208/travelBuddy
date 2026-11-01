package com.tripsplit.common;

import com.tripsplit.model.Expense;
import com.tripsplit.model.ExpenseSplit;
import com.tripsplit.model.Settlement;

import java.util.*;

/**
 * Pure money logic (no database). net = paid - share + settlementsPaid - settlementsReceived.
 * Positive net: should receive. Negative net: owes. All nets add up to exactly zero.
 */
public final class BalanceCalculator {
    private BalanceCalculator() {}

    public record MemberBalance(UUID memberId, long paid, long share, long settledOut, long settledIn) {
        public long net() { return paid - share + settledOut - settledIn; }
    }

    public record Transfer(UUID from, UUID to, long amountPaise) {}

    private static final class Entry {
        final UUID id;
        long amount;
        Entry(UUID id, long amount) { this.id = id; this.amount = amount; }
    }

    /** Expects only non-deleted expenses and their splits. */
    public static Map<UUID, MemberBalance> compute(Collection<UUID> memberIds,
                                                   List<Expense> expenses,
                                                   List<ExpenseSplit> splits,
                                                   List<Settlement> settlements) {
        Map<UUID, long[]> acc = new LinkedHashMap<>(); // [paid, share, out, in]
        for (UUID id : memberIds) acc.put(id, new long[4]);
        for (Expense e : expenses) acc.computeIfAbsent(e.getPaidBy(), k -> new long[4])[0] += e.getAmountPaise();
        for (ExpenseSplit s : splits) acc.computeIfAbsent(s.getMemberId(), k -> new long[4])[1] += s.getSharePaise();
        for (Settlement s : settlements) {
            acc.computeIfAbsent(s.getFromMember(), k -> new long[4])[2] += s.getAmountPaise();
            acc.computeIfAbsent(s.getToMember(), k -> new long[4])[3] += s.getAmountPaise();
        }
        Map<UUID, MemberBalance> out = new LinkedHashMap<>();
        acc.forEach((id, a) -> out.put(id, new MemberBalance(id, a[0], a[1], a[2], a[3])));
        return out;
    }

    /** Greedy: repeatedly match the biggest debtor with the biggest creditor. */
    public static List<Transfer> suggest(Map<UUID, Long> nets) {
        Comparator<Entry> byAmountDesc = (a, b) -> Long.compare(b.amount, a.amount);
        PriorityQueue<Entry> creditors = new PriorityQueue<>(byAmountDesc);
        PriorityQueue<Entry> debtors = new PriorityQueue<>(byAmountDesc);
        nets.forEach((id, net) -> {
            if (net > 0) creditors.add(new Entry(id, net));
            else if (net < 0) debtors.add(new Entry(id, -net));
        });
        List<Transfer> result = new ArrayList<>();
        while (!creditors.isEmpty() && !debtors.isEmpty()) {
            Entry c = creditors.poll();
            Entry d = debtors.poll();
            long amt = Math.min(c.amount, d.amount);
            result.add(new Transfer(d.id, c.id, amt));
            c.amount -= amt;
            d.amount -= amt;
            if (c.amount > 0) creditors.add(c);
            if (d.amount > 0) debtors.add(d);
        }
        return result;
    }
}
