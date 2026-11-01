package com.tripsplit.service;

import com.tripsplit.common.ApiException;
import com.tripsplit.common.Money;
import com.tripsplit.common.SplitCalculator;
import com.tripsplit.model.*;
import com.tripsplit.repo.ExpenseRepository;
import com.tripsplit.repo.ExpenseSplitRepository;
import com.tripsplit.web.Dtos.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ExpenseService {
    private final TripAccess access;
    private final ExpenseRepository expenses;
    private final ExpenseSplitRepository splits;
    private final ActivityService activity;
    private final NotificationService notifications;

    // ---------------------------------------------------------------- create

    @Transactional
    public ExpenseDto create(UUID tripId, UUID userId, ExpenseRequest r) {
        Member me = access.member(tripId, userId);
        Trip trip = access.openTrip(tripId);
        Map<UUID, Member> byId = access.membersById(tripId);

        // Same requestId again (network retry) -> return what was already saved.
        Optional<Expense> dup = expenses.findByTripIdAndRequestId(tripId, r.requestId());
        if (dup.isPresent()) {
            return toDto(dup.get(), byId, splits.findByExpenseId(dup.get().getId()));
        }

        long amount = Money.parseToPaise(r.amount());
        if (amount <= 0) throw ApiException.badRequest("INVALID_AMOUNT", "Amount must be greater than zero");
        Set<UUID> participants = new LinkedHashSet<>(r.splitAmong());
        validateMembers(byId, r.paidBy(), participants, Set.of());
        Map<UUID, Long> shares = SplitCalculator.equalSplit(amount, participants);

        Expense e = new Expense();
        e.setId(UUID.randomUUID());
        e.setTripId(tripId);
        e.setPaidBy(r.paidBy());
        e.setAmountPaise(amount);
        e.setTitle(r.title().trim());
        e.setCategory(category(r.category()));
        e.setExpenseDate(r.date());
        e.setRequestId(r.requestId());
        e.setCreatedBy(me.getId());
        expenses.save(e);                       // @Version is null, so this is a real INSERT
        saveSplits(e, shares);

        String msg = me.getName() + " added " + Money.format(amount, trip.getCurrency()) + " for " + e.getTitle()
                + ". Paid by " + TripAccess.nameOf(byId, e.getPaidBy()) + ". Split equally among " + names(byId, shares.keySet()) + ".";
        activity.log(tripId, me.getId(), ActivityType.EXPENSE_ADDED, e.getId(), msg);
        notifications.notifyTrip(tripId, userId, "New expense in " + trip.getName(), msg);
        return toDto(e, byId, splits.findByExpenseId(e.getId()));
    }

    // ---------------------------------------------------------------- update

    @Transactional
    public ExpenseDto update(UUID tripId, UUID expenseId, UUID userId, ExpenseRequest r) {
        Member me = access.member(tripId, userId);
        Trip trip = access.openTrip(tripId);
        Expense e = expenses.findByIdAndTripId(expenseId, tripId)
                .filter(x -> x.getDeletedAt() == null)
                .orElseThrow(() -> ApiException.notFound("Expense not found"));
        if (r.version() == null || !r.version().equals(e.getVersion())) {
            throw ApiException.conflict("EXPENSE_CONFLICT", "Someone else changed this expense. Reload it and try again.");
        }
        Map<UUID, Member> byId = access.membersById(tripId);
        List<ExpenseSplit> oldSplits = splits.findByExpenseId(e.getId());
        Set<UUID> oldMembers = oldSplits.stream().map(ExpenseSplit::getMemberId).collect(Collectors.toCollection(TreeSet::new));

        long amount = Money.parseToPaise(r.amount());
        if (amount <= 0) throw ApiException.badRequest("INVALID_AMOUNT", "Amount must be greater than zero");
        Set<UUID> participants = new TreeSet<>(r.splitAmong());
        Set<UUID> alreadyInvolved = new HashSet<>(oldMembers);
        alreadyInvolved.add(e.getPaidBy());
        validateMembers(byId, r.paidBy(), participants, alreadyInvolved);
        Map<UUID, Long> shares = SplitCalculator.equalSplit(amount, participants);

        List<String> changes = new ArrayList<>();
        String newTitle = r.title().trim();
        String cur = trip.getCurrency();
        if (!e.getTitle().equals(newTitle)) changes.add("title \"" + e.getTitle() + "\" → \"" + newTitle + "\"");
        if (e.getAmountPaise() != amount) changes.add("amount " + Money.format(e.getAmountPaise(), cur) + " → " + Money.format(amount, cur));
        if (!e.getPaidBy().equals(r.paidBy())) changes.add("paid by " + TripAccess.nameOf(byId, e.getPaidBy()) + " → " + TripAccess.nameOf(byId, r.paidBy()));
        if (!oldMembers.equals(participants)) changes.add("split now among " + names(byId, participants));
        if (!e.getCategory().equals(category(r.category()))) changes.add("category " + e.getCategory() + " → " + category(r.category()));
        if (!e.getExpenseDate().equals(r.date())) changes.add("date " + e.getExpenseDate() + " → " + r.date());

        e.setTitle(newTitle);
        e.setAmountPaise(amount);
        e.setPaidBy(r.paidBy());
        e.setCategory(category(r.category()));
        e.setExpenseDate(r.date());
        e.setUpdatedAt(Instant.now());

        splits.deleteAllForExpense(e.getId());   // bulk delete (also flushes the expense change)
        saveSplits(e, shares);
        expenses.saveAndFlush(e);                // bumps the version

        String msg = me.getName() + " edited " + newTitle + (changes.isEmpty() ? "." : ": " + String.join("; ", changes) + ".");
        activity.log(tripId, me.getId(), ActivityType.EXPENSE_EDITED, e.getId(), msg);
        notifications.notifyTrip(tripId, userId, "Expense edited in " + trip.getName(), msg);
        return toDto(e, byId, splits.findByExpenseId(e.getId()));
    }

    // ---------------------------------------------------------------- delete

    @Transactional
    public void delete(UUID tripId, UUID expenseId, UUID userId) {
        Member me = access.member(tripId, userId);
        Trip trip = access.openTrip(tripId);
        Expense e = expenses.findByIdAndTripId(expenseId, tripId)
                .filter(x -> x.getDeletedAt() == null)
                .orElseThrow(() -> ApiException.notFound("Expense not found"));
        e.setDeletedAt(Instant.now());           // soft delete: stays in history and in the Excel ledger
        e.setUpdatedAt(Instant.now());
        String msg = me.getName() + " deleted " + e.getTitle() + " (" + Money.format(e.getAmountPaise(), trip.getCurrency()) + ").";
        activity.log(tripId, me.getId(), ActivityType.EXPENSE_DELETED, e.getId(), msg);
        notifications.notifyTrip(tripId, userId, "Expense deleted in " + trip.getName(), msg);
    }

    // ---------------------------------------------------------------- list

    @Transactional(readOnly = true)
    public ExpensePage list(UUID tripId, UUID userId, int page, int size,
                            UUID paidBy, String category, LocalDate from, LocalDate to) {
        access.member(tripId, userId);
        Map<UUID, Member> byId = access.membersById(tripId);
        String cat = (category == null || category.isBlank()) ? null : category.trim().toUpperCase();

        List<Expense> filtered = expenses.findByTripIdAndDeletedAtIsNullOrderByExpenseDateDescCreatedAtDesc(tripId).stream()
                .filter(e -> paidBy == null || e.getPaidBy().equals(paidBy))
                .filter(e -> cat == null || e.getCategory().equals(cat))
                .filter(e -> from == null || !e.getExpenseDate().isBefore(from))
                .filter(e -> to == null || !e.getExpenseDate().isAfter(to))
                .toList();

        int sz = ActivityService.clamp(size);
        int pg = Math.max(page, 0);
        int start = Math.min(pg * sz, filtered.size());
        List<Expense> slice = filtered.subList(start, Math.min(start + sz, filtered.size()));

        Map<UUID, List<ExpenseSplit>> splitsByExpense = slice.isEmpty() ? Map.of() :
                splits.findByExpenseIdIn(slice.stream().map(Expense::getId).toList()).stream()
                        .collect(Collectors.groupingBy(ExpenseSplit::getExpenseId));
        List<ExpenseDto> items = slice.stream()
                .map(e -> toDto(e, byId, splitsByExpense.getOrDefault(e.getId(), List.of()))).toList();
        return new ExpensePage(items, pg, sz, filtered.size());
    }

    // ---------------------------------------------------------------- helpers

    private void saveSplits(Expense e, Map<UUID, Long> shares) {
        shares.forEach((memberId, share) -> {
            ExpenseSplit s = new ExpenseSplit();
            s.setId(UUID.randomUUID());
            s.setExpenseId(e.getId());
            s.setTripId(e.getTripId());
            s.setMemberId(memberId);
            s.setSharePaise(share);
            splits.save(s);
        });
    }

    /** Payer and sharers must belong to THIS trip, be accepted members, and not have left (unless already on this expense). */
    private void validateMembers(Map<UUID, Member> byId, UUID paidBy, Set<UUID> participants, Set<UUID> allowedLeft) {
        Set<UUID> all = new HashSet<>(participants);
        all.add(paidBy);
        for (UUID id : all) {
            Member m = byId.get(id);
            if (m == null || m.getStatus() != MemberStatus.ACTIVE) {
                throw ApiException.badRequest("INVALID_MEMBER", "Payer or participant is not a member of this trip");
            }
            if (m.getLeftAt() != null && !allowedLeft.contains(id)) {
                throw ApiException.badRequest("MEMBER_LEFT", m.getName() + " has left the trip");
            }
        }
        if (participants.isEmpty()) throw ApiException.badRequest("NO_PARTICIPANTS", "Choose at least one person to split with");
    }

    private static String category(String c) {
        return (c == null || c.isBlank()) ? "OTHER" : c.trim().toUpperCase();
    }

    private static String names(Map<UUID, Member> byId, Collection<UUID> ids) {
        return ids.stream().map(id -> TripAccess.nameOf(byId, id)).sorted().collect(Collectors.joining(", "));
    }

    private ExpenseDto toDto(Expense e, Map<UUID, Member> byId, List<ExpenseSplit> sp) {
        List<SplitDto> splitDtos = sp.stream()
                .map(s -> new SplitDto(s.getMemberId(), TripAccess.nameOf(byId, s.getMemberId()), s.getSharePaise()))
                .sorted(Comparator.comparing(SplitDto::memberName)).toList();
        return new ExpenseDto(e.getId(), e.getTitle(), e.getAmountPaise(), Money.plain(e.getAmountPaise()),
                e.getPaidBy(), TripAccess.nameOf(byId, e.getPaidBy()), e.getCategory(), e.getExpenseDate(),
                splitDtos, e.getVersion(), TripAccess.nameOf(byId, e.getCreatedBy()), e.getCreatedAt(), e.getUpdatedAt());
    }
}
