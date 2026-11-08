package com.tripsplit.common;

import com.tripsplit.model.Expense;
import com.tripsplit.model.ExpenseSplit;
import com.tripsplit.model.Settlement;

import java.util.*;

/**
 * Pure money logic (no database, no Spring, no framework dependencies).
 * Net balance formula: net = paid - share + settlementsPaid - settlementsReceived.
 * Positive net: should receive money (creditor).
 * Negative net: owes money (debtor).
 * Invariant: Sum of all net balances across the trip must be exactly zero.
 */
public final class BalanceCalculator {
    private BalanceCalculator() {}

    public record MemberBalance(UUID memberId, long paid, long share, long settledOut, long settledIn) {
        public long net() {
            long expenseNet = Math.subtractExact(paid, share);
            long settlementNet = Math.subtractExact(settledOut, settledIn);
            return Math.addExact(expenseNet, settlementNet);
        }
    }

    public record Transfer(UUID from, UUID to, long amountPaise) {}

    private static final class Entry {
        final UUID id;
        long amount;
        Entry(UUID id, long amount) { this.id = id; this.amount = amount; }
    }

    /**
     * Computes the net balance ledger for a trip.
     * Expects non-deleted expenses, their splits, and recorded settlements.
     * Validates:
     *   1. All participants belong to valid trip memberIds.
     *   2. Each expense's splits sum to exactly the expense amount.
     *   3. All additions/subtractions are overflow-checked with Math.addExact.
     */
    public static Map<UUID, MemberBalance> compute(Collection<UUID> memberIds,
                                                   List<Expense> expenses,
                                                   List<ExpenseSplit> splits,
                                                   List<Settlement> settlements) {
        if (memberIds == null || memberIds.isEmpty()) {
            return Collections.emptyMap();
        }
        Set<UUID> validMembers = new HashSet<>(memberIds);

        // 1. Validate expense totals against splits
        if (expenses != null && splits != null && !expenses.isEmpty()) {
            Map<UUID, Long> splitSums = new HashMap<>();
            for (ExpenseSplit s : splits) {
                if (!validMembers.contains(s.getMemberId())) {
                    throw new IllegalArgumentException("Split member " + s.getMemberId() + " does not belong to the trip members");
                }
                splitSums.merge(s.getExpenseId(), s.getSharePaise(), Math::addExact);
            }
            for (Expense e : expenses) {
                long sum = splitSums.getOrDefault(e.getId(), 0L);
                if (sum != e.getAmountPaise()) {
                    throw new IllegalStateException("Expense " + e.getId() + " total (" + e.getAmountPaise()
                            + ") does not match sum of splits (" + sum + ")");
                }
            }
        }

        // 2. Accumulate ledger: [0: paid, 1: share, 2: settledOut, 3: settledIn]
        Map<UUID, long[]> acc = new LinkedHashMap<>();
        for (UUID id : memberIds) acc.put(id, new long[4]);

        if (expenses != null) {
            for (Expense e : expenses) {
                if (!validMembers.contains(e.getPaidBy())) {
                    throw new IllegalArgumentException("Expense payer " + e.getPaidBy() + " does not belong to the trip members");
                }
                long[] a = acc.get(e.getPaidBy());
                a[0] = Math.addExact(a[0], e.getAmountPaise());
            }
        }

        if (splits != null) {
            for (ExpenseSplit s : splits) {
                long[] a = acc.get(s.getMemberId());
                a[1] = Math.addExact(a[1], s.getSharePaise());
            }
        }

        if (settlements != null) {
            for (Settlement s : settlements) {
                if (!validMembers.contains(s.getFromMember())) {
                    throw new IllegalArgumentException("Settlement debtor " + s.getFromMember() + " does not belong to the trip members");
                }
                if (!validMembers.contains(s.getToMember())) {
                    throw new IllegalArgumentException("Settlement creditor " + s.getToMember() + " does not belong to the trip members");
                }
                long[] from = acc.get(s.getFromMember());
                from[2] = Math.addExact(from[2], s.getAmountPaise());

                long[] to = acc.get(s.getToMember());
                to[3] = Math.addExact(to[3], s.getAmountPaise());
            }
        }

        Map<UUID, MemberBalance> out = new LinkedHashMap<>();
        acc.forEach((id, a) -> out.put(id, new MemberBalance(id, a[0], a[1], a[2], a[3])));
        return out;
    }

    /**
     * Greedy two-pointer debt simplification: repeatedly matches the biggest debtor with the biggest creditor.
     * Enforces:
     *   1. Zero-sum validation: sum of all net balances must equal 0 before running.
     *   2. Stable tie-breaking: uses amount descending, then UUID ascending.
     *   3. Safe negation: uses Math.negateExact(net) to prevent -Long.MIN_VALUE overflow.
     */
    public static List<Transfer> suggest(Map<UUID, Long> nets) {
        if (nets == null || nets.isEmpty()) {
            return Collections.emptyList();
        }

        // Validate zero-sum invariant
        long zeroCheck = 0;
        for (long net : nets.values()) {
            zeroCheck = Math.addExact(zeroCheck, net);
        }
        if (zeroCheck != 0) {
            throw new IllegalStateException("Balances do not sum to zero (imbalance: " + zeroCheck + " paise)");
        }

        // Comparator with secondary UUID tie-breaker for deterministic, reproducible transfers
        Comparator<Entry> byAmountDescThenId = Comparator
                .<Entry>comparingLong(e -> e.amount).reversed()
                .thenComparing(e -> e.id);

        PriorityQueue<Entry> creditors = new PriorityQueue<>(byAmountDescThenId);
        PriorityQueue<Entry> debtors = new PriorityQueue<>(byAmountDescThenId);

        nets.forEach((id, net) -> {
            if (net > 0) creditors.add(new Entry(id, net));
            else if (net < 0) debtors.add(new Entry(id, Math.negateExact(net)));
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

        if (!creditors.isEmpty() || !debtors.isEmpty()) {
            throw new IllegalStateException("Incomplete debt resolution: unmatched balances remain");
        }

        return result;
    }
}
