package com.tripsplit;

import com.tripsplit.common.ApiException;
import com.tripsplit.common.BalanceCalculator;
import com.tripsplit.common.BalanceCalculator.MemberBalance;
import com.tripsplit.common.Money;
import com.tripsplit.common.SplitCalculator;
import com.tripsplit.model.Expense;
import com.tripsplit.model.ExpenseSplit;
import com.tripsplit.model.Settlement;
import org.junit.jupiter.api.Test;

import java.util.*;

import static org.junit.jupiter.api.Assertions.*;

class SplitAndBalanceTest {

    @Test
    void equalSplitAddsUpExactly() {
        List<UUID> ids = List.of(UUID.randomUUID(), UUID.randomUUID(), UUID.randomUUID());
        Map<UUID, Long> shares = SplitCalculator.equalSplit(10000, ids);
        assertEquals(10000, shares.values().stream().mapToLong(Long::longValue).sum());
        List<Long> sorted = new ArrayList<>(shares.values());
        Collections.sort(sorted);
        assertEquals(List.of(3333L, 3333L, 3334L), sorted);
    }

    @Test
    void equalSplitAlwaysSumsToTotal() {
        Random rnd = new Random(42);
        for (int i = 0; i < 2000; i++) {
            long total = 1 + rnd.nextInt(10_000_000);
            int n = 1 + rnd.nextInt(12);
            List<UUID> ids = new ArrayList<>();
            for (int k = 0; k < n; k++) ids.add(UUID.randomUUID());
            Map<UUID, Long> s = SplitCalculator.equalSplit(total, ids);
            assertEquals(total, s.values().stream().mapToLong(Long::longValue).sum());
            long min = Collections.min(s.values()), max = Collections.max(s.values());
            assertTrue(max - min <= 1);
        }
    }

    @Test
    void netPositionsSumToZeroAndSettlementMovesValue() {
        UUID a = UUID.randomUUID(), b = UUID.randomUUID(), c = UUID.randomUUID();
        Expense e1 = expense(a, 30000);
        Expense e2 = expense(b, 10000);
        List<ExpenseSplit> splits = new ArrayList<>();
        splits.addAll(splitsFor(e1, 10000, a, b, c));
        splits.addAll(splitsFor(e2, 5000, a, b));

        Map<UUID, MemberBalance> bal = BalanceCalculator.compute(List.of(a, b, c), List.of(e1, e2), splits, List.of());
        assertEquals(0, bal.values().stream().mapToLong(MemberBalance::net).sum());
        assertEquals(40000, bal.values().stream().mapToLong(MemberBalance::paid).sum());
        assertEquals(40000, bal.values().stream().mapToLong(MemberBalance::share).sum());

        // c owes 10000 -> pays a
        Settlement s = new Settlement();
        s.setFromMember(c); s.setToMember(a); s.setAmountPaise(10000);
        Map<UUID, MemberBalance> after = BalanceCalculator.compute(List.of(a, b, c), List.of(e1, e2), splits, List.of(s));
        assertEquals(0, after.values().stream().mapToLong(MemberBalance::net).sum());
        assertEquals(0, after.get(c).net());
    }

    @Test
    void suggestionsClearEveryone() {
        Map<UUID, Long> nets = new LinkedHashMap<>();
        UUID a = UUID.randomUUID(), b = UUID.randomUUID(), c = UUID.randomUUID(), d = UUID.randomUUID();
        nets.put(a, 7000L); nets.put(b, -2000L); nets.put(c, -3000L); nets.put(d, -2000L);
        Map<UUID, Long> left = new HashMap<>(nets);
        for (var t : BalanceCalculator.suggest(nets)) {
            left.merge(t.from(), t.amountPaise(), Long::sum);
            left.merge(t.to(), -t.amountPaise(), Long::sum);
        }
        assertTrue(left.values().stream().allMatch(v -> v == 0));
    }

    @Test
    void moneyParsingAndFormatting() {
        assertEquals(120000, Money.parseToPaise("1200"));
        assertEquals(120050, Money.parseToPaise("1200.5"));
        assertEquals(1, Money.parseToPaise("0.01"));
        assertThrows(ApiException.class, () -> Money.parseToPaise("1.005"));
        assertThrows(ApiException.class, () -> Money.parseToPaise("abc"));
        assertEquals("₹1,23,456.70", Money.format(12345670, "INR"));
        assertEquals("₹999.00", Money.format(99900, "INR"));
        assertEquals("12.50", Money.plain(1250));
    }

    private static Expense expense(UUID paidBy, long amount) {
        Expense e = new Expense();
        e.setId(UUID.randomUUID());
        e.setPaidBy(paidBy);
        e.setAmountPaise(amount);
        return e;
    }

    private static List<ExpenseSplit> splitsFor(Expense e, long share, UUID... members) {
        List<ExpenseSplit> out = new ArrayList<>();
        for (UUID m : members) {
            ExpenseSplit s = new ExpenseSplit();
            s.setExpenseId(e.getId());
            s.setMemberId(m);
            s.setSharePaise(share);
            out.add(s);
        }
        return out;
    }
}
