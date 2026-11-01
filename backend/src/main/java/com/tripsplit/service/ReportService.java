package com.tripsplit.service;

import com.tripsplit.common.Money;
import com.tripsplit.model.*;
import com.tripsplit.repo.ActivityRepository;
import com.tripsplit.repo.ExpenseRepository;
import com.tripsplit.repo.ExpenseSplitRepository;
import com.tripsplit.web.Dtos.BalanceDto;
import com.tripsplit.web.Dtos.BalancesResponse;
import com.tripsplit.web.Dtos.SettlementDto;
import com.tripsplit.web.Dtos.TransferDto;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Builds the .xlsx on request. Runs in ONE repeatable-read transaction so every sheet shows the
 * same moment of the ledger, and the numbers equal the balances screen. Nothing is stored.
 *
 * Sheet layout:
 *   1. Summary    — trip metadata snapshot
 *   2. Expenses   — full enriched ledger (one row per expense) — also the import template format
 *   3. Settlement — per-member balance + suggested repayments + recorded settlements
 *   4. History    — activity log
 */
@Service
public class ReportService {
    public record Report(String fileName, byte[] bytes) {}

    private final TripAccess access;
    private final MoneyService money;
    private final ExpenseRepository expenses;
    private final ExpenseSplitRepository splits;
    private final ActivityRepository activities;
    private final DateTimeFormatter stamp;
    private final DateTimeFormatter dateOnly;
    private final ZoneId tz;

    public ReportService(TripAccess access, MoneyService money, ExpenseRepository expenses,
                         ExpenseSplitRepository splits, ActivityRepository activities,
                         @Value("${app.timezone}") String timezone) {
        this.access = access;
        this.money = money;
        this.expenses = expenses;
        this.splits = splits;
        this.activities = activities;
        this.tz = ZoneId.of(timezone);
        this.stamp = DateTimeFormatter.ofPattern("dd MMM yyyy HH:mm").withZone(tz);
        this.dateOnly = DateTimeFormatter.ofPattern("dd MMM yyyy").withZone(tz);
    }

    @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
    public Report generate(UUID tripId, UUID userId) {
        access.member(tripId, userId);
        Trip trip = access.trip(tripId);
        Map<UUID, Member> byId = access.membersById(tripId);
        BalancesResponse bal = money.compute(tripId);

        try (XSSFWorkbook wb = new XSSFWorkbook()) {
            Styles st = new Styles(wb);
            summarySheet(wb, st, trip, bal);
            expensesSheet(wb, st, trip, byId, bal);
            settlementSheet(wb, st, bal);
            historySheet(wb, st, byId, tripId);
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            wb.write(out);
            String safe = trip.getName().replaceAll("[^A-Za-z0-9_-]+", "_");
            return new Report(safe + "_ledger.xlsx", out.toByteArray());
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    // ------------------------------------------------------------ sheets

    private void summarySheet(Workbook wb, Styles st, Trip trip, BalancesResponse bal) {
        Sheet sh = wb.createSheet("Summary");
        int r = 0;
        r = kv(sh, st, r, "Trip", trip.getName(), null);
        r = kv(sh, st, r, "Destination", trip.getDestination(), null);
        String dateRange = (trip.getStartDate() == null ? "" : trip.getStartDate().toString())
                + (trip.getEndDate() == null ? "" : " to " + trip.getEndDate());
        r = kv(sh, st, r, "Dates", dateRange.isBlank() ? "—" : dateRange, null);
        r = kv(sh, st, r, "Currency", trip.getCurrency(), null);
        r = kv(sh, st, r, "Status", trip.getStatus().name(), null);
        r = kv(sh, st, r, "Members", String.valueOf(bal.members().size()), null);
        r = kv(sh, st, r, "Total spent", null, st.amount(bal.totalSpentPaise()));
        r = kv(sh, st, r, "Generated at", stamp.format(Instant.now()), null);
        sh.setColumnWidth(0, 22 * 256);
        sh.setColumnWidth(1, 40 * 256);
    }

    /**
     * Expenses sheet — canonical format used for both download and upload.
     *
     * Fixed columns (A–J):
     *   A  Date (YYYY-MM-DD)
     *   B  Time added (HH:mm)
     *   C  Title / Description
     *   D  Category
     *   E  Paid By
     *   F  Total Amount
     *   G  No. of People Sharing
     *   H  Split Type  (EQUAL / CUSTOM)
     *   I  Status  (Active / DELETED)
     *   J  Added By
     *
     * Dynamic share columns (K onward): one column per member "Share: <name>"
     *
     * Last row: TOTALS
     */
    private void expensesSheet(Workbook wb, Styles st, Trip trip, Map<UUID, Member> byId, BalancesResponse bal) {
        Sheet sh = wb.createSheet("Expenses");

        List<BalanceDto> members = bal.members();   // columns K+
        List<String> head = new ArrayList<>(List.of(
                "Date", "Time Added", "Title / Description", "Category",
                "Paid By", "Total Amount", "People Sharing", "Split Type", "Status", "Added By"
        ));
        for (BalanceDto m : members) head.add("Share: " + m.name());
        int r = header(sh, st, 0, head.toArray(new String[0]));

        List<Expense> all = expenses.findByTripIdOrderByExpenseDateAscCreatedAtAsc(trip.getId());
        Map<UUID, List<ExpenseSplit>> splitsBy = all.isEmpty() ? Map.of() :
                splits.findByExpenseIdIn(all.stream().map(Expense::getId).toList()).stream()
                        .collect(Collectors.groupingBy(ExpenseSplit::getExpenseId));

        long liveTotal = 0;
        Map<UUID, Long> shareTotals = new HashMap<>();

        for (Expense e : all) {
            boolean deleted = e.getDeletedAt() != null;
            List<ExpenseSplit> expSplits = splitsBy.getOrDefault(e.getId(), List.of());
            long peopleSharing = expSplits.stream().filter(s -> s.getSharePaise() > 0).count();
            Map<UUID, Long> shareOf = expSplits.stream()
                    .collect(Collectors.toMap(ExpenseSplit::getMemberId, ExpenseSplit::getSharePaise));

            // Detect split type: EQUAL if all non-zero shares are within 1 paise of amount/count
            String splitType = "EQUAL";
            if (peopleSharing > 0) {
                long expected = e.getAmountPaise() / peopleSharing;
                boolean isEqual = shareOf.values().stream()
                        .filter(v -> v > 0)
                        .allMatch(v -> Math.abs(v - expected) <= 1);
                splitType = isEqual ? "EQUAL" : "CUSTOM";
            }

            Row row = sh.createRow(r++);
            // A: Date
            row.createCell(0).setCellValue(e.getExpenseDate() == null ? "" : e.getExpenseDate().toString());
            // B: Time added
            row.createCell(1).setCellValue(stamp.format(e.getCreatedAt()));
            // C: Title
            row.createCell(2).setCellValue(e.getTitle());
            // D: Category
            row.createCell(3).setCellValue(e.getCategory());
            // E: Paid by
            row.createCell(4).setCellValue(TripAccess.nameOf(byId, e.getPaidBy()));
            // F: Amount
            amountCell(row, 5, st, e.getAmountPaise());
            // G: People sharing
            Cell pplCell = row.createCell(6);
            pplCell.setCellValue(peopleSharing);
            // H: Split type
            row.createCell(7).setCellValue(splitType);
            // I: Status
            row.createCell(8).setCellValue(deleted ? "DELETED" : "Active");
            // J: Added by
            row.createCell(9).setCellValue(TripAccess.nameOf(byId, e.getCreatedBy()));
            // K+: Per-member shares
            for (int i = 0; i < members.size(); i++) {
                Long share = shareOf.get(members.get(i).memberId());
                if (share != null && share > 0) amountCell(row, 10 + i, st, share);
            }

            if (!deleted) {
                liveTotal += e.getAmountPaise();
                shareOf.forEach((k, v) -> shareTotals.merge(k, v, Long::sum));
            }
        }

        // Totals row
        Row total = sh.createRow(r++);
        Cell lbl = total.createCell(4);
        lbl.setCellValue("TOTAL (active expenses)");
        lbl.setCellStyle(st.bold);
        Cell tc = total.createCell(5);
        tc.setCellValue(liveTotal / 100.0);
        tc.setCellStyle(st.boldAmount);
        for (int i = 0; i < members.size(); i++) {
            Cell c = total.createCell(10 + i);
            c.setCellValue(shareTotals.getOrDefault(members.get(i).memberId(), 0L) / 100.0);
            c.setCellStyle(st.boldAmount);
        }

        sh.createFreezePane(0, 1);
        // Column widths
        int[] widths = {14, 20, 32, 16, 18, 16, 16, 14, 12, 18};
        for (int i = 0; i < widths.length; i++) sh.setColumnWidth(i, widths[i] * 256);
        for (int i = 10; i < head.size(); i++) sh.setColumnWidth(i, 18 * 256);
    }

    private void settlementSheet(Workbook wb, Styles st, BalancesResponse bal) {
        Sheet sh = wb.createSheet("Settlement");
        int r = 0;
        r = header(sh, st, r, "Name", "Type", "Total Paid", "Their Share", "Repaid Others", "Received Repayments", "Net (+ receives / − owes)");
        for (BalanceDto b : bal.members()) {
            Row row = sh.createRow(r++);
            row.createCell(0).setCellValue(b.name());
            row.createCell(1).setCellValue(b.guest() ? "Guest" : "Registered");
            amountCell(row, 2, st, b.paidPaise());
            amountCell(row, 3, st, b.sharePaise());
            amountCell(row, 4, st, b.settledOutPaise());
            amountCell(row, 5, st, b.settledInPaise());
            amountCell(row, 6, st, b.netPaise());
        }
        r++;
        sh.createRow(r++).createCell(0).setCellValue("Suggested repayments");
        r = header(sh, st, r, "From", "To", "Amount");
        for (TransferDto t : bal.suggested()) {
            Row row = sh.createRow(r++);
            row.createCell(0).setCellValue(t.fromName());
            row.createCell(1).setCellValue(t.toName());
            amountCell(row, 2, st, t.amountPaise());
        }
        r++;
        sh.createRow(r++).createCell(0).setCellValue("Recorded settlements");
        r = header(sh, st, r, "When", "From", "To", "Amount");
        for (SettlementDto s : bal.settlements()) {
            Row row = sh.createRow(r++);
            row.createCell(0).setCellValue(stamp.format(s.createdAt()));
            row.createCell(1).setCellValue(s.fromName());
            row.createCell(2).setCellValue(s.toName());
            amountCell(row, 3, st, s.amountPaise());
        }
        for (int c = 0; c < 7; c++) sh.setColumnWidth(c, 24 * 256);
    }

    private void historySheet(Workbook wb, Styles st, Map<UUID, Member> byId, UUID tripId) {
        Sheet sh = wb.createSheet("History");
        int r = header(sh, st, 0, "When", "Type", "By", "Details");
        for (Activity a : activities.findByTripIdOrderByCreatedAtAsc(tripId)) {
            Row row = sh.createRow(r++);
            row.createCell(0).setCellValue(stamp.format(a.getCreatedAt()));
            row.createCell(1).setCellValue(a.getType().name());
            row.createCell(2).setCellValue(TripAccess.nameOf(byId, a.getActorId()));
            row.createCell(3).setCellValue(a.getMessage());
        }
        sh.createFreezePane(0, 1);
        sh.setColumnWidth(0, 20 * 256);
        sh.setColumnWidth(1, 22 * 256);
        sh.setColumnWidth(2, 18 * 256);
        sh.setColumnWidth(3, 110 * 256);
    }

    // ------------------------------------------------------------ helpers

    private int header(Sheet sh, Styles st, int rowIdx, String... names) {
        Row row = sh.createRow(rowIdx);
        for (int i = 0; i < names.length; i++) {
            Cell c = row.createCell(i);
            c.setCellValue(names[i]);
            c.setCellStyle(st.header);
        }
        return rowIdx + 1;
    }

    private int kv(Sheet sh, Styles st, int r, String key, String text, Object amountMarker) {
        Row row = sh.createRow(r);
        Cell k = row.createCell(0);
        k.setCellValue(key);
        k.setCellStyle(st.keyStyle);
        Cell v = row.createCell(1);
        if (amountMarker instanceof AmountValue av) {
            v.setCellValue(av.paise / 100.0);
            v.setCellStyle(av.style);
        } else {
            v.setCellValue(text == null ? "" : text);
        }
        return r + 1;
    }

    private void amountCell(Row row, int col, Styles st, long paise) {
        Cell c = row.createCell(col);
        c.setCellValue(paise / 100.0);     // display only; all calculations done in paise
        c.setCellStyle(st.amount);
    }

    private record AmountValue(long paise, CellStyle style) {}

    private static final class Styles {
        final CellStyle header, amount, bold, boldAmount, keyStyle;

        Styles(Workbook wb) {
            Font boldFont = wb.createFont();
            boldFont.setBold(true);
            Font keyFont = wb.createFont();
            keyFont.setBold(true);
            keyFont.setColor(IndexedColors.DARK_BLUE.getIndex());
            DataFormat df = wb.createDataFormat();

            header = wb.createCellStyle();
            header.setFont(boldFont);
            header.setFillForegroundColor(IndexedColors.GREY_25_PERCENT.getIndex());
            header.setFillPattern(FillPatternType.SOLID_FOREGROUND);
            header.setBorderBottom(BorderStyle.THIN);

            keyStyle = wb.createCellStyle();
            keyStyle.setFont(keyFont);

            amount = wb.createCellStyle();
            amount.setDataFormat(df.getFormat("#,##0.00"));

            bold = wb.createCellStyle();
            bold.setFont(boldFont);

            boldAmount = wb.createCellStyle();
            boldAmount.setFont(boldFont);
            boldAmount.setDataFormat(df.getFormat("#,##0.00"));
        }

        AmountValue amount(long paise) { return new AmountValue(paise, amount); }
    }
}
