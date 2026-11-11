package com.tripsplit.service;

import com.tripsplit.common.ApiException;
import com.tripsplit.model.*;
import com.tripsplit.repo.*;
import com.tripsplit.web.Dtos.*;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.ZoneId;
import java.time.DayOfWeek;
import java.time.format.DateTimeFormatter;
import java.time.temporal.TemporalAdjusters;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class UserService {
    private final UserRepository users;
    private final DeviceTokenRepository devices;
    private final MemberRepository members;
    private final TripRepository trips;
    private final ExpenseRepository expenses;
    private final ExpenseSplitRepository splits;
    private final PasswordEncoder encoder;

    @Transactional(readOnly = true)
    public UserDto me(UUID userId) {
        User u = users.findById(userId).orElseThrow(() -> ApiException.unauthorized("NO_USER", "Please log in again"));
        return new UserDto(u.getId(), u.getName(), u.getEmail());
    }

    @Transactional
    public UserDto updateProfile(UUID userId, com.tripsplit.web.Dtos.UpdateProfileRequest r) {
        User u = users.findById(userId).orElseThrow(() -> ApiException.unauthorized("NO_USER", "Please log in again"));
        u.setName(r.name().trim());
        users.save(u);
        return new UserDto(u.getId(), u.getName(), u.getEmail());
    }

    @Transactional
    public void saveDevice(UUID userId, DeviceRequest r) {
        DeviceToken d = devices.findByFcmToken(r.fcmToken()).orElseGet(() -> {
            DeviceToken n = new DeviceToken();
            n.setId(UUID.randomUUID());
            n.setFcmToken(r.fcmToken());
            return n;
        });
        d.setUserId(userId);      // a phone token belongs to whoever logged in last
        d.setPlatform(r.platform());
        devices.save(d);
    }

    @Transactional
    public void removeDevice(UUID userId, String token) {
        devices.findByFcmToken(token).filter(d -> d.getUserId().equals(userId))
                .ifPresent(d -> devices.deleteByFcmToken(token));
    }

    /**
     * Deletes the account. The person stays in old trips as a plain name (financial history is kept),
     * but can no longer log in or see anything.
     */
    @Transactional
    public void deleteAccount(UUID userId, String password) {
        User u = users.findById(userId).orElseThrow(() -> ApiException.unauthorized("NO_USER", "Please log in again"));
        if (!encoder.matches(password, u.getPasswordHash())) {
            throw ApiException.forbidden("WRONG_PASSWORD", "Wrong password");
        }
        if (trips.existsByCreatedByAndDeletedAtIsNull(userId)) {
            throw ApiException.conflict("OWNS_TRIPS", "Delete the trips you own before deleting your account");
        }
        for (Member m : members.findByUserId(userId)) {
            if (m.getStatus() == MemberStatus.PENDING) {
                members.delete(m);
            } else {
                m.setUserId(null);
                if (m.getLeftAt() == null) m.setLeftAt(Instant.now());
            }
        }
        members.flush();
        users.delete(u);   // refresh tokens, codes, devices, notifications are removed by ON DELETE CASCADE
    }

    /**
     * Comprehensive monthly spending analytics for the user.
     * Computes personal share, paid amounts, group turnover, categories, weeks, active trips,
     * and returns historical available months so past data is never lost.
     */
    @Transactional(readOnly = true)
    public UserAnalyticsResponse analytics(UUID userId, String monthStr) {
        YearMonth ym;
        try {
            ym = (monthStr != null && !monthStr.isBlank()) ? YearMonth.parse(monthStr.trim()) : YearMonth.now();
        } catch (Exception e) {
            ym = YearMonth.now();
        }

        LocalDate monthStart = ym.atDay(1);
        LocalDate monthEnd = ym.atEndOfMonth();

        List<Member> myMembers = members.findByUserId(userId);
        if (myMembers.isEmpty()) {
            return new UserAnalyticsResponse(
                    ym.toString(), 0L, 0L, 0L, 0L, 0, 0,
                    defaultCurrentWeek(), defaultDays(ym), defaultWeeks(ym),
                    defaultCategories(), List.of(), List.of(ym.toString()), List.of()
            );
        }

        Map<UUID, Member> myMemberByTripId = new HashMap<>();
        Set<UUID> myMemberIds = new HashSet<>();
        for (Member m : myMembers) {
            myMemberByTripId.put(m.getTripId(), m);
            myMemberIds.add(m.getId());
        }

        List<Trip> myTrips = trips.findAllById(myMemberByTripId.keySet()).stream()
                .filter(t -> t.getDeletedAt() == null)
                .toList();

        if (myTrips.isEmpty()) {
            return new UserAnalyticsResponse(
                    ym.toString(), 0L, 0L, 0L, 0L, 0, 0,
                    defaultCurrentWeek(), defaultDays(ym), defaultWeeks(ym),
                    defaultCategories(), List.of(), List.of(ym.toString()), List.of()
            );
        }

        Map<UUID, Trip> tripById = myTrips.stream().collect(Collectors.toMap(Trip::getId, t -> t));
        List<UUID> validTripIds = new ArrayList<>(tripById.keySet());

        List<Expense> allUserTripExpenses = expenses.findByTripIdInAndDeletedAtIsNull(validTripIds);

        // Compute availableMonths across all active trips for historical archive selector
        Set<String> monthsSet = new TreeSet<>(Comparator.reverseOrder());
        monthsSet.add(YearMonth.now().toString());
        for (Expense e : allUserTripExpenses) {
            LocalDate d = e.getExpenseDate() != null ? e.getExpenseDate()
                    : e.getCreatedAt().atZone(ZoneId.systemDefault()).toLocalDate();
            monthsSet.add(YearMonth.from(d).toString());
        }
        List<String> availableMonths = new ArrayList<>(monthsSet);

        // Compute current calendar week stats (Monday - Sunday) across active trips
        LocalDate today = LocalDate.now();
        LocalDate weekStart = today.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
        LocalDate weekEnd = today.with(TemporalAdjusters.nextOrSame(DayOfWeek.SUNDAY));
        String currentWeekLabel = formatWeekRange(weekStart, weekEnd);

        List<Expense> currentWeekExpenses = allUserTripExpenses.stream()
                .filter(e -> {
                    LocalDate d = e.getExpenseDate() != null ? e.getExpenseDate()
                            : e.getCreatedAt().atZone(ZoneId.systemDefault()).toLocalDate();
                    return !d.isBefore(weekStart) && !d.isAfter(weekEnd);
                }).toList();

        List<UUID> cwExpIds = currentWeekExpenses.stream().map(Expense::getId).toList();
        List<ExpenseSplit> cwSplits = cwExpIds.isEmpty() ? List.of() : splits.findByExpenseIdIn(cwExpIds);
        Map<UUID, List<ExpenseSplit>> cwSplitsByExpId = cwSplits.stream().collect(Collectors.groupingBy(ExpenseSplit::getExpenseId));

        long cwPersonalShare = 0L;
        long cwPaid = 0L;
        long cwGroup = 0L;
        for (Expense e : currentWeekExpenses) {
            long amt = e.getAmountPaise();
            cwGroup += amt;
            if (myMemberIds.contains(e.getPaidBy())) {
                cwPaid += amt;
            }
            for (ExpenseSplit sp : cwSplitsByExpId.getOrDefault(e.getId(), List.of())) {
                if (myMemberIds.contains(sp.getMemberId())) {
                    cwPersonalShare += sp.getSharePaise();
                }
            }
        }
        UserCurrentWeekStat currentWeekStat = new UserCurrentWeekStat(
                currentWeekLabel, weekStart, weekEnd,
                cwPersonalShare, cwPaid, cwGroup, cwPaid - cwPersonalShare, currentWeekExpenses.size()
        );

        // Filter expenses for selected month
        List<Expense> monthExpenses = allUserTripExpenses.stream()
                .filter(e -> {
                    LocalDate d = e.getExpenseDate() != null ? e.getExpenseDate()
                            : e.getCreatedAt().atZone(ZoneId.systemDefault()).toLocalDate();
                    return !d.isBefore(monthStart) && !d.isAfter(monthEnd);
                })
                .sorted(Comparator.comparing(Expense::getExpenseDate, Comparator.nullsLast(Comparator.reverseOrder()))
                        .thenComparing(Expense::getCreatedAt, Comparator.reverseOrder()))
                .toList();

        List<UUID> monthExpenseIds = monthExpenses.stream().map(Expense::getId).toList();
        List<ExpenseSplit> monthSplits = monthExpenseIds.isEmpty() ? List.of()
                : splits.findByExpenseIdIn(monthExpenseIds);

        Map<UUID, List<ExpenseSplit>> splitsByExpenseId = monthSplits.stream()
                .collect(Collectors.groupingBy(ExpenseSplit::getExpenseId));

        Map<UUID, Map<UUID, Member>> allTripMembers = new HashMap<>();
        for (UUID tid : validTripIds) {
            allTripMembers.put(tid, members.findByTripId(tid).stream()
                    .collect(Collectors.toMap(Member::getId, m -> m, (a, b) -> a)));
        }

        long groupTotalPaise = 0L;
        long myPersonalSharePaise = 0L;
        long myPaidPaise = 0L;

        Map<String, long[]> catStats = new LinkedHashMap<>();
        for (String cat : List.of("FOOD", "STAY", "TRANSPORT", "FUEL", "ACTIVITIES", "SHOPPING", "OTHER")) {
            catStats.put(cat, new long[]{0L, 0L, 0L});
        }

        int daysInMonth = ym.lengthOfMonth();
        long[][] dayBuckets = new long[daysInMonth + 1][3]; // [dayOfMonth][0=share, 1=group, 2=count]
        long[][] weekBuckets = new long[4][3]; // [weekIdx][0=personalShare, 1=groupSpent, 2=count]
        Map<UUID, long[]> tripStats = new LinkedHashMap<>();
        List<UserExpenseItem> expenseItems = new ArrayList<>();

        for (Expense e : monthExpenses) {
            long amount = e.getAmountPaise();
            groupTotalPaise += amount;

            boolean isPaidByMe = myMemberIds.contains(e.getPaidBy());
            if (isPaidByMe) {
                myPaidPaise += amount;
            }

            List<ExpenseSplit> spList = splitsByExpenseId.getOrDefault(e.getId(), List.of());
            long myShareForThisExpense = 0L;
            for (ExpenseSplit sp : spList) {
                if (myMemberIds.contains(sp.getMemberId())) {
                    myShareForThisExpense += sp.getSharePaise();
                }
            }
            myPersonalSharePaise += myShareForThisExpense;

            String rawCat = (e.getCategory() != null && !e.getCategory().isBlank())
                    ? e.getCategory().toUpperCase().trim() : "OTHER";
            long[] cVals = catStats.computeIfAbsent(rawCat, k -> new long[]{0L, 0L, 0L});
            cVals[0] += myShareForThisExpense;
            cVals[1] += amount;
            cVals[2] += 1;

            LocalDate expDate = e.getExpenseDate() != null ? e.getExpenseDate()
                    : e.getCreatedAt().atZone(ZoneId.systemDefault()).toLocalDate();
            int day = expDate.getDayOfMonth();
            if (day >= 1 && day <= daysInMonth) {
                dayBuckets[day][0] += myShareForThisExpense;
                dayBuckets[day][1] += amount;
                dayBuckets[day][2] += 1;
            }

            int weekIdx = (day <= 7) ? 0 : (day <= 14) ? 1 : (day <= 21) ? 2 : 3;
            weekBuckets[weekIdx][0] += myShareForThisExpense;
            weekBuckets[weekIdx][1] += amount;
            weekBuckets[weekIdx][2] += 1;

            long[] tVals = tripStats.computeIfAbsent(e.getTripId(), k -> new long[]{0L, 0L, 0L, 0L});
            tVals[0] += amount;
            tVals[1] += myShareForThisExpense;
            if (isPaidByMe) tVals[2] += amount;
            tVals[3] += 1;

            Trip tr = tripById.get(e.getTripId());
            String tripName = tr != null ? tr.getName() : "Trip";
            Map<UUID, Member> tMembers = allTripMembers.getOrDefault(e.getTripId(), Map.of());
            Member payerMember = tMembers.get(e.getPaidBy());
            String paidByName = payerMember != null ? payerMember.getName() : "Someone";

            expenseItems.add(new UserExpenseItem(
                    e.getId(),
                    e.getTripId(),
                    tripName,
                    e.getTitle(),
                    rawCat,
                    amount,
                    myShareForThisExpense,
                    paidByName,
                    isPaidByMe,
                    expDate
            ));
        }

        long netDuesPaise = myPaidPaise - myPersonalSharePaise;

        List<UserDayStat> byDay = new ArrayList<>(daysInMonth);
        for (int d = 1; d <= daysInMonth; d++) {
            byDay.add(new UserDayStat(ym.atDay(d), d, dayBuckets[d][0], dayBuckets[d][1], (int) dayBuckets[d][2]));
        }

        List<UserCategoryStat> byCategory = new ArrayList<>();
        for (Map.Entry<String, long[]> entry : catStats.entrySet()) {
            String cat = entry.getKey();
            long[] v = entry.getValue();
            double personalPct = myPersonalSharePaise > 0 ? (double) v[0] / myPersonalSharePaise * 100.0 : 0.0;
            double groupPct = groupTotalPaise > 0 ? (double) v[1] / groupTotalPaise * 100.0 : 0.0;
            byCategory.add(new UserCategoryStat(
                    cat, v[0], v[1], (int) v[2],
                    Math.round(personalPct * 10.0) / 10.0,
                    Math.round(groupPct * 10.0) / 10.0
            ));
        }

        String shortMonth = ym.getMonth().name().substring(0, 1) + ym.getMonth().name().substring(1, 3).toLowerCase();
        List<UserWeekStat> byWeek = List.of(
                new UserWeekStat(1, "Week 1 (1–7 " + shortMonth + ")", ym.atDay(1), ym.atDay(Math.min(7, daysInMonth)), weekBuckets[0][0], weekBuckets[0][1], (int) weekBuckets[0][2]),
                new UserWeekStat(2, "Week 2 (8–14 " + shortMonth + ")", ym.atDay(Math.min(8, daysInMonth)), ym.atDay(Math.min(14, daysInMonth)), weekBuckets[1][0], weekBuckets[1][1], (int) weekBuckets[1][2]),
                new UserWeekStat(3, "Week 3 (15–21 " + shortMonth + ")", ym.atDay(Math.min(15, daysInMonth)), ym.atDay(Math.min(21, daysInMonth)), weekBuckets[2][0], weekBuckets[2][1], (int) weekBuckets[2][2]),
                new UserWeekStat(4, "Week 4+ (22–" + daysInMonth + " " + shortMonth + ")", ym.atDay(Math.min(22, daysInMonth)), ym.atDay(daysInMonth), weekBuckets[3][0], weekBuckets[3][1], (int) weekBuckets[3][2])
        );

        List<UserTripStat> byTrip = new ArrayList<>();
        for (Map.Entry<UUID, long[]> entry : tripStats.entrySet()) {
            UUID tid = entry.getKey();
            long[] v = entry.getValue();
            Trip tr = tripById.get(tid);
            String tripName = tr != null ? tr.getName() : "Trip";
            String dest = tr != null ? tr.getDestination() : "";
            String curr = tr != null ? tr.getCurrency() : "INR";
            byTrip.add(new UserTripStat(
                    tid, tripName, dest, curr,
                    v[0], v[1], v[2], v[2] - v[1], (int) v[3]
            ));
        }
        byTrip.sort(Comparator.comparingLong(UserTripStat::personalSharePaise).reversed());

        return new UserAnalyticsResponse(
                ym.toString(),
                myPersonalSharePaise,
                myPaidPaise,
                groupTotalPaise,
                netDuesPaise,
                monthExpenses.size(),
                byTrip.size(),
                currentWeekStat,
                byDay,
                byWeek,
                byCategory,
                byTrip,
                availableMonths,
                expenseItems
        );
    }

    private String formatWeekRange(LocalDate start, LocalDate end) {
        DateTimeFormatter mFmt = DateTimeFormatter.ofPattern("MMM d", Locale.ENGLISH);
        if (start.getMonth() == end.getMonth()) {
            return start.format(mFmt) + " – " + end.getDayOfMonth();
        }
        return start.format(mFmt) + " – " + end.format(mFmt);
    }

    private UserCurrentWeekStat defaultCurrentWeek() {
        LocalDate today = LocalDate.now();
        LocalDate ws = today.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
        LocalDate we = today.with(TemporalAdjusters.nextOrSame(DayOfWeek.SUNDAY));
        return new UserCurrentWeekStat(formatWeekRange(ws, we), ws, we, 0L, 0L, 0L, 0L, 0);
    }

    private List<UserDayStat> defaultDays(YearMonth ym) {
        int days = ym.lengthOfMonth();
        List<UserDayStat> list = new ArrayList<>(days);
        for (int d = 1; d <= days; d++) {
            list.add(new UserDayStat(ym.atDay(d), d, 0L, 0L, 0));
        }
        return list;
    }

    private List<UserWeekStat> defaultWeeks(YearMonth ym) {
        int days = ym.lengthOfMonth();
        String sm = ym.getMonth().name().substring(0, 1) + ym.getMonth().name().substring(1, 3).toLowerCase();
        return List.of(
                new UserWeekStat(1, "Week 1 (1–7 " + sm + ")", ym.atDay(1), ym.atDay(Math.min(7, days)), 0L, 0L, 0),
                new UserWeekStat(2, "Week 2 (8–14 " + sm + ")", ym.atDay(Math.min(8, days)), ym.atDay(Math.min(14, days)), 0L, 0L, 0),
                new UserWeekStat(3, "Week 3 (15–21 " + sm + ")", ym.atDay(Math.min(15, days)), ym.atDay(Math.min(21, days)), 0L, 0L, 0),
                new UserWeekStat(4, "Week 4+ (22–" + days + " " + sm + ")", ym.atDay(Math.min(22, days)), ym.atDay(days), 0L, 0L, 0)
        );
    }

    private List<UserCategoryStat> defaultCategories() {
        return List.of("FOOD", "STAY", "TRANSPORT", "FUEL", "ACTIVITIES", "SHOPPING", "OTHER").stream()
                .map(c -> new UserCategoryStat(c, 0L, 0L, 0, 0.0, 0.0))
                .toList();
    }
}
