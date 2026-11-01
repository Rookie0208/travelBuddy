package com.tripsplit.service;

import com.tripsplit.common.ApiException;
import com.tripsplit.common.BalanceCalculator;
import com.tripsplit.common.BalanceCalculator.MemberBalance;
import com.tripsplit.common.BalanceCalculator.Transfer;
import com.tripsplit.common.Money;
import com.tripsplit.model.*;
import com.tripsplit.repo.ExpenseRepository;
import com.tripsplit.repo.ExpenseSplitRepository;
import com.tripsplit.repo.SettlementRepository;
import com.tripsplit.web.Dtos.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;

/** Balances, suggested repayments, recorded settlements, trip stats and comments. */
@Service
@RequiredArgsConstructor
public class MoneyService {
    private final TripAccess access;
    private final ExpenseRepository expenses;
    private final ExpenseSplitRepository splits;
    private final SettlementRepository settlements;
    private final ActivityService activity;
    private final NotificationService notifications;

    @Transactional(readOnly = true)
    public BalancesResponse balances(UUID tripId, UUID userId) {
        access.member(tripId, userId);
        return compute(tripId);
    }

    /** One consistent view of the ledger. Also used by the Excel export. */
    BalancesResponse compute(UUID tripId) {
        Trip trip = access.trip(tripId);
        Map<UUID, Member> byId = access.membersById(tripId);
        List<Expense> liveExpenses = expenses.findByTripIdAndDeletedAtIsNull(tripId);
        List<ExpenseSplit> liveSplits = liveExpenses.isEmpty() ? List.of()
                : splits.findByExpenseIdIn(liveExpenses.stream().map(Expense::getId).toList());
        List<Settlement> sets = settlements.findByTripIdOrderByCreatedAtAsc(tripId);

        List<UUID> activeIds = byId.values().stream()
                .filter(m -> m.getStatus() == MemberStatus.ACTIVE).map(Member::getId).toList();
        Map<UUID, MemberBalance> bal = BalanceCalculator.compute(activeIds, liveExpenses, liveSplits, sets);

        List<BalanceDto> rows = new ArrayList<>();
        Map<UUID, Long> nets = new LinkedHashMap<>();
        for (MemberBalance b : bal.values()) {
            Member m = byId.get(b.memberId());
            boolean allZero = b.paid() == 0 && b.share() == 0 && b.settledOut() == 0 && b.settledIn() == 0;
            if (m != null && m.getLeftAt() != null && allZero) continue;      // hide people who left with no money activity
            rows.add(new BalanceDto(b.memberId(), TripAccess.nameOf(byId, b.memberId()), m == null || m.getUserId() == null,
                    b.paid(), b.share(), b.settledOut(), b.settledIn(), b.net()));
            nets.put(b.memberId(), b.net());
        }
        rows.sort(Comparator.comparing(BalanceDto::name, String.CASE_INSENSITIVE_ORDER));

        List<TransferDto> suggested = BalanceCalculator.suggest(nets).stream()
                .map((Transfer t) -> new TransferDto(t.from(), TripAccess.nameOf(byId, t.from()),
                        t.to(), TripAccess.nameOf(byId, t.to()), t.amountPaise())).toList();
        List<SettlementDto> setDtos = sets.stream()
                .map(s -> new SettlementDto(s.getId(), s.getFromMember(), TripAccess.nameOf(byId, s.getFromMember()),
                        s.getToMember(), TripAccess.nameOf(byId, s.getToMember()), s.getAmountPaise(), s.getCreatedAt())).toList();
        long total = liveExpenses.stream().mapToLong(Expense::getAmountPaise).sum();
        boolean allSettled = nets.values().stream().allMatch(n -> n == 0);
        return new BalancesResponse(trip.getCurrency(), trip.getStatus(), total, rows, suggested, setDtos, allSettled);
    }

    @Transactional
    public SettlementDto recordSettlement(UUID tripId, UUID userId, SettlementRequest r) {
        Member me = access.owner(tripId, userId);
        Trip trip = access.openTrip(tripId);
        Map<UUID, Member> byId = access.membersById(tripId);

        Optional<Settlement> dup = settlements.findByTripIdAndRequestId(tripId, r.requestId());
        if (dup.isPresent()) return toDto(dup.get(), byId);

        long amount = Money.parseToPaise(r.amount());
        if (amount <= 0) throw ApiException.badRequest("INVALID_AMOUNT", "Amount must be greater than zero");
        if (r.fromMember().equals(r.toMember())) throw ApiException.badRequest("SAME_MEMBER", "Choose two different people");
        for (UUID id : List.of(r.fromMember(), r.toMember())) {
            Member m = byId.get(id);
            if (m == null || m.getStatus() != MemberStatus.ACTIVE) {
                throw ApiException.badRequest("INVALID_MEMBER", "Both people must belong to this trip");
            }
        }
        Settlement s = new Settlement();
        s.setId(UUID.randomUUID());
        s.setTripId(tripId);
        s.setFromMember(r.fromMember());
        s.setToMember(r.toMember());
        s.setAmountPaise(amount);
        s.setRequestId(r.requestId());
        s.setCreatedBy(me.getId());
        settlements.save(s);

        String msg = me.getName() + " recorded: " + TripAccess.nameOf(byId, s.getFromMember()) + " paid "
                + TripAccess.nameOf(byId, s.getToMember()) + " " + Money.format(amount, trip.getCurrency()) + ".";
        activity.log(tripId, me.getId(), ActivityType.SETTLEMENT_RECORDED, null, msg);
        notifications.notifyTrip(tripId, userId, "Settlement recorded", msg);
        return toDto(s, byId);
    }

    @Transactional
    public BalancesResponse markSettled(UUID tripId, UUID userId) {
        Member me = access.owner(tripId, userId);
        Trip trip = access.openTrip(tripId);
        BalancesResponse b = compute(tripId);
        if (!b.allSettled()) {
            throw ApiException.conflict("NOT_FULLY_SETTLED", "Some people still owe or are owed money. Record the repayments first.");
        }
        trip.setStatus(TripStatus.SETTLED);
        String msg = me.getName() + " marked the trip as settled.";
        activity.log(tripId, me.getId(), ActivityType.TRIP_SETTLED, null, msg);
        notifications.notifyTrip(tripId, userId, "Trip settled", msg);
        return compute(tripId);
    }

    @Transactional
    public BalancesResponse reopen(UUID tripId, UUID userId) {
        Member me = access.owner(tripId, userId);
        Trip trip = access.trip(tripId);
        trip.setStatus(TripStatus.ACTIVE);
        String msg = me.getName() + " reopened the trip.";
        activity.log(tripId, me.getId(), ActivityType.TRIP_REOPENED, null, msg);
        notifications.notifyTrip(tripId, userId, "Trip reopened", msg);
        return compute(tripId);
    }

    @Transactional(readOnly = true)
    public StatsResponse stats(UUID tripId, UUID userId) {
        access.member(tripId, userId);
        Trip trip = access.trip(tripId);
        List<Expense> live = expenses.findByTripIdAndDeletedAtIsNull(tripId);
        Map<String, Long> byCategory = new TreeMap<>();
        Map<LocalDate, Long> byDay = new TreeMap<>();
        long total = 0;
        for (Expense e : live) {
            total += e.getAmountPaise();
            byCategory.merge(e.getCategory(), e.getAmountPaise(), Long::sum);
            byDay.merge(e.getExpenseDate(), e.getAmountPaise(), Long::sum);
        }
        return new StatsResponse(trip.getCurrency(), total, byCategory, byDay);
    }

    /** A comment or a query (question) that everyone in the trip can see. */
    @Transactional
    public ActivityDto comment(UUID tripId, UUID userId, CommentRequest r) {
        Member me = access.member(tripId, userId);
        Trip trip = access.trip(tripId);
        if (r.expenseId() != null) {
            expenses.findByIdAndTripId(r.expenseId(), tripId)
                    .orElseThrow(() -> ApiException.badRequest("INVALID_EXPENSE", "Expense not found in this trip"));
        }
        String text = r.message().trim();
        ActivityType type = r.query() ? ActivityType.QUERY : ActivityType.COMMENT;
        Activity a = activity.log(tripId, me.getId(), type, r.expenseId(), text);
        String preview = text.length() > 80 ? text.substring(0, 80) + "…" : text;
        notifications.notifyTrip(tripId, userId, trip.getName(),
                me.getName() + (r.query() ? " raised a query: " : " commented: ") + preview);
        return activity.toDto(a, access.membersById(tripId));
    }

    private SettlementDto toDto(Settlement s, Map<UUID, Member> byId) {
        return new SettlementDto(s.getId(), s.getFromMember(), TripAccess.nameOf(byId, s.getFromMember()),
                s.getToMember(), TripAccess.nameOf(byId, s.getToMember()), s.getAmountPaise(), s.getCreatedAt());
    }
}
