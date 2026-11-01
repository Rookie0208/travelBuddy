package com.tripsplit.web;

import com.tripsplit.service.ActivityService;
import com.tripsplit.service.ExpenseService;
import com.tripsplit.service.MoneyService;
import com.tripsplit.service.ReportService;
import com.tripsplit.web.Dtos.*;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/trips/{tripId}")
@RequiredArgsConstructor
public class LedgerController {
    private static final MediaType XLSX =
            MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");

    private final ExpenseService expenses;
    private final MoneyService money;
    private final ActivityService activity;
    private final ReportService reports;

    // ---- expenses ----
    @GetMapping("/expenses")
    public ExpensePage list(@AuthenticationPrincipal UUID userId, @PathVariable UUID tripId,
                            @RequestParam(defaultValue = "0") int page,
                            @RequestParam(defaultValue = "50") int size,
                            @RequestParam(required = false) UUID paidBy,
                            @RequestParam(required = false) String category,
                            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
                            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return expenses.list(tripId, userId, page, size, paidBy, category, from, to);
    }

    @PostMapping("/expenses")
    @ResponseStatus(HttpStatus.CREATED)
    public ExpenseDto create(@AuthenticationPrincipal UUID userId, @PathVariable UUID tripId,
                             @Valid @RequestBody ExpenseRequest r) {
        return expenses.create(tripId, userId, r);
    }

    @PutMapping("/expenses/{expenseId}")
    public ExpenseDto update(@AuthenticationPrincipal UUID userId, @PathVariable UUID tripId,
                             @PathVariable UUID expenseId, @Valid @RequestBody ExpenseRequest r) {
        return expenses.update(tripId, expenseId, userId, r);
    }

    @DeleteMapping("/expenses/{expenseId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@AuthenticationPrincipal UUID userId, @PathVariable UUID tripId, @PathVariable UUID expenseId) {
        expenses.delete(tripId, expenseId, userId);
    }

    // ---- history, comments, queries ----
    @GetMapping("/activities")
    public ActivityPage activities(@AuthenticationPrincipal UUID userId, @PathVariable UUID tripId,
                                   @RequestParam(defaultValue = "0") int page,
                                   @RequestParam(defaultValue = "50") int size) {
        return activity.list(tripId, userId, page, size);
    }

    @PostMapping("/comments")
    @ResponseStatus(HttpStatus.CREATED)
    public ActivityDto comment(@AuthenticationPrincipal UUID userId, @PathVariable UUID tripId,
                               @Valid @RequestBody CommentRequest r) {
        return money.comment(tripId, userId, r);
    }

    // ---- balances, settlements, stats ----
    @GetMapping("/balances")
    public BalancesResponse balances(@AuthenticationPrincipal UUID userId, @PathVariable UUID tripId) {
        return money.balances(tripId, userId);
    }

    @PostMapping("/settlements")
    @ResponseStatus(HttpStatus.CREATED)
    public SettlementDto settle(@AuthenticationPrincipal UUID userId, @PathVariable UUID tripId,
                                @Valid @RequestBody SettlementRequest r) {
        return money.recordSettlement(tripId, userId, r);
    }

    @PostMapping("/settle")
    public BalancesResponse markSettled(@AuthenticationPrincipal UUID userId, @PathVariable UUID tripId) {
        return money.markSettled(tripId, userId);
    }

    @PostMapping("/reopen")
    public BalancesResponse reopen(@AuthenticationPrincipal UUID userId, @PathVariable UUID tripId) {
        return money.reopen(tripId, userId);
    }

    @GetMapping("/stats")
    public StatsResponse stats(@AuthenticationPrincipal UUID userId, @PathVariable UUID tripId) {
        return money.stats(tripId, userId);
    }

    // ---- Excel ----
    @GetMapping("/export.xlsx")
    public ResponseEntity<byte[]> export(@AuthenticationPrincipal UUID userId, @PathVariable UUID tripId) {
        ReportService.Report rep = reports.generate(tripId, userId);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        ContentDisposition.attachment().filename(rep.fileName(), StandardCharsets.UTF_8).build().toString())
                .header(HttpHeaders.CACHE_CONTROL, "no-store")
                .contentType(XLSX)
                .body(rep.bytes());
    }
}
