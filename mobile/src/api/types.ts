export type Role = 'OWNER' | 'MEMBER';
export type TripStatus = 'ACTIVE' | 'SETTLED';
export type ActivityType =
  | 'TRIP_CREATED' | 'TRIP_UPDATED' | 'MEMBER_ADDED' | 'MEMBER_JOINED' | 'MEMBER_REMOVED' | 'MEMBER_LEFT'
  | 'MEMBER_UNLINKED' | 'MEMBER_RENAMED' | 'EXPENSE_ADDED' | 'EXPENSE_EDITED' | 'EXPENSE_DELETED'
  | 'SETTLEMENT_RECORDED' | 'TRIP_SETTLED' | 'TRIP_REOPENED' | 'COMMENT' | 'QUERY';

export interface User { id: string; name: string; email: string }
export interface Friend { id: string; name: string; email: string }
export interface AuthResponse { accessToken: string; refreshToken: string; user: User }

export interface TripSummary {
  id: string; name: string; destination: string | null; startDate: string | null; endDate: string | null;
  currency: string; status: TripStatus; memberCount: number; owner: boolean; totalSpentPaise: number;
}
export interface Member { id: string; name: string; guest: boolean; role: Role; left: boolean }
export interface PendingRequest {
  memberId: string; name: string; claimMemberId: string | null; claimMemberName: string | null; requestedAt: string;
}
export interface TripDetail {
  id: string; name: string; destination: string | null; startDate: string | null; endDate: string | null;
  notes: string | null; currency: string; status: TripStatus; myMemberId: string; myRole: Role;
  inviteCode: string | null; members: Member[]; joinRequests: PendingRequest[];
}
export interface JoinPreview {
  tripId: string; tripName: string; ownerName: string; myStatus: 'NONE' | 'PENDING' | 'ACTIVE';
  claimableMembers: Member[];
}
export interface JoinResult { status: string; tripId: string }

export interface Split { memberId: string; memberName: string; sharePaise: number }
export interface Expense {
  id: string; title: string; amountPaise: number; amount: string; paidBy: string; paidByName: string;
  category: string; date: string; splits: Split[]; version: number; createdByName: string;
  createdAt: string; updatedAt: string;
}
export interface ExpensePage { items: Expense[]; page: number; size: number; total: number }
export interface ExpenseInput {
  requestId: string; title: string; amount: string; paidBy: string; splitAmong: string[];
  category: string; date: string; version?: number;
}

export interface Activity {
  id: string; type: ActivityType; actorName: string; message: string; expenseId: string | null; createdAt: string;
}
export interface ActivityPage { items: Activity[]; page: number; size: number; total: number }

export interface Balance {
  memberId: string; name: string; guest: boolean; paidPaise: number; sharePaise: number;
  settledOutPaise: number; settledInPaise: number; netPaise: number;
}
export interface Transfer { fromMemberId: string; fromName: string; toMemberId: string; toName: string; amountPaise: number }
export interface Settlement {
  id: string; fromMemberId: string; fromName: string; toMemberId: string; toName: string;
  amountPaise: number; createdAt: string;
}
export interface Balances {
  currency: string; status: TripStatus; totalSpentPaise: number; members: Balance[];
  suggested: Transfer[]; settlements: Settlement[]; allSettled: boolean;
}
export interface Stats { currency: string; totalSpentPaise: number; byCategory: Record<string, number>; byDay: Record<string, number> }

export interface AppNotification { id: string; tripId: string | null; message: string; seen: boolean; createdAt: string }
export interface NotificationPage { items: AppNotification[]; unread: number; page: number; size: number; total: number }
