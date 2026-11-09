package com.tripsplit.web;

import com.tripsplit.model.ActivityType;
import com.tripsplit.model.Role;
import com.tripsplit.model.TripStatus;
import jakarta.validation.constraints.*;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/** Request/response shapes. Amounts in responses are in paise (…Paise) so the app never does float maths. */
public final class Dtos {
    private Dtos() {}

    // ---- auth / account ----
    public record RegisterRequest(@NotBlank @Size(max = 100) String name,
                                  @NotBlank @Email @Size(max = 255) String email,
                                  @NotBlank @Size(min = 8, max = 72) String password) {}
    public record EmailRequest(@NotBlank @Email String email) {}
    public record VerifyEmailRequest(@NotBlank @Email String email, @NotBlank String code) {}
    public record LoginRequest(@NotBlank String email, @NotBlank String password) {}
    public record RefreshRequest(@NotBlank String refreshToken) {}
    public record UserDto(UUID id, String name, String email) {}
    public record UpdateProfileRequest(@NotBlank @Size(max = 100) String name) {}
    public record AuthResponse(String accessToken, String refreshToken, UserDto user) {}
    public record MessageResponse(String message) {}
    public record DeviceRequest(@NotBlank @Size(max = 512) String fcmToken,
                                @NotBlank @Pattern(regexp = "ANDROID|IOS") String platform) {}
    public record DeleteAccountRequest(@NotBlank String password) {}
    public record NotificationDto(UUID id, UUID tripId, String message, boolean seen, Instant createdAt) {}
    public record NotificationPage(List<NotificationDto> items, long unread, int page, int size, long total) {}

    // ---- trips ----
    public record CreateTripRequest(@NotBlank @Size(max = 100) String name,
                                    @Size(max = 100) String destination,
                                    LocalDate startDate, LocalDate endDate,
                                    @Size(max = 2000) String notes,
                                    @Size(min = 3, max = 3) String currency,
                                    List<@NotBlank @Size(max = 100) String> guestNames) {}
    public record UpdateTripRequest(@NotBlank @Size(max = 100) String name,
                                    @Size(max = 100) String destination,
                                    LocalDate startDate, LocalDate endDate,
                                    @Size(max = 2000) String notes) {}
    public record TripSummary(UUID id, String name, String destination, LocalDate startDate, LocalDate endDate,
                              String currency, TripStatus status, long memberCount, boolean owner,
                              long totalSpentPaise) {}
    public record MemberDto(UUID id, String name, boolean guest, Role role, boolean left) {}
    public record PendingRequestDto(UUID memberId, String name, UUID claimMemberId, String claimMemberName,
                                    Instant requestedAt) {}
    public record TripDetail(UUID id, String name, String destination, LocalDate startDate, LocalDate endDate,
                             String notes, String currency, TripStatus status, UUID myMemberId, Role myRole,
                             String inviteCode, List<MemberDto> members, List<PendingRequestDto> joinRequests) {}
    public record NameRequest(@NotBlank @Size(max = 100) String name) {}
    public record InviteCodeResponse(String inviteCode) {}
    public record JoinPreview(UUID tripId, String tripName, String ownerName, String myStatus,
                              List<MemberDto> claimableMembers) {}
    public record JoinRequest(UUID claimMemberId) {}
    public record JoinResult(String status, UUID tripId) {}

    // ---- expenses ----
    public record ExpenseRequest(@NotNull UUID requestId,
                                 @NotBlank @Size(max = 150) String title,
                                 @NotBlank String amount,
                                 @NotNull UUID paidBy,
                                 @NotEmpty List<UUID> splitAmong,
                                 @Size(max = 30) String category,
                                 @NotNull LocalDate date,
                                 Long version) {}
    public record SplitDto(UUID memberId, String memberName, long sharePaise) {}
    public record ExpenseDto(UUID id, String title, long amountPaise, String amount, UUID paidBy, String paidByName,
                             String category, LocalDate date, List<SplitDto> splits, Long version,
                             String createdByName, Instant createdAt, Instant updatedAt) {}
    public record ExpensePage(List<ExpenseDto> items, int page, int size, long total) {}

    // ---- history / comments ----
    public record CommentRequest(@NotBlank @Size(max = 1000) String message, boolean query, UUID expenseId) {}
    public record ActivityDto(UUID id, ActivityType type, String actorName, String message, UUID expenseId,
                              Instant createdAt) {}
    public record ActivityPage(List<ActivityDto> items, int page, int size, long total) {}

    // ---- balances / settlements ----
    public record BalanceDto(UUID memberId, String name, boolean guest, long paidPaise, long sharePaise,
                             long settledOutPaise, long settledInPaise, long netPaise) {}
    public record TransferDto(UUID fromMemberId, String fromName, UUID toMemberId, String toName, long amountPaise) {}
    public record SettlementRequest(@NotNull UUID requestId, @NotNull UUID fromMember, @NotNull UUID toMember,
                                    @NotBlank String amount) {}
    public record SettlementDto(UUID id, UUID fromMemberId, String fromName, UUID toMemberId, String toName,
                                long amountPaise, Instant createdAt) {}
    public record BalancesResponse(String currency, TripStatus status, long totalSpentPaise,
                                   List<BalanceDto> members, List<TransferDto> suggested,
                                   List<SettlementDto> settlements, boolean allSettled) {}
    public record MemberSpendingDto(UUID memberId, String name, long paidPaise, long sharePaise, long netPaise,
                                    double paidPercent, double sharePercent) {}
    public record TopExpenseDto(UUID id, String title, String category, long amountPaise, String paidByName,
                                LocalDate date) {}
    public record StatsResponse(String currency, long totalSpentPaise, long myPaidPaise, long mySharePaise,
                                long myNetPaise, int totalExpensesCount, long averageExpensePaise,
                                long dailyAveragePaise, Map<String, Long> byCategory, Map<LocalDate, Long> byDay,
                                List<MemberSpendingDto> memberSpending, List<TopExpenseDto> topExpenses) {}
}
