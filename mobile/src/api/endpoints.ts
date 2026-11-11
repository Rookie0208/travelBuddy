import { api } from './client';
import type * as T from './types';

const d = <R>(p: Promise<{ data: R }>): Promise<R> => p.then((r) => r.data);

export const auth = {
  register: (name: string, email: string, password: string) => d<{ message: string }>(api.post('/auth/register', { name, email, password })),
  verify: (email: string, code: string) => d<T.AuthResponse>(api.post('/auth/verify-email', { email, code })),
  resend: (email: string) => d<{ message: string }>(api.post('/auth/resend-code', { email })),
  login: (email: string, password: string) => d<T.AuthResponse>(api.post('/auth/login', { email, password })),
  logout: (refreshToken: string) => api.post('/auth/logout', { refreshToken }),
  me: () => d<T.User>(api.get('/me')),
  updateProfile: (name: string) => d<T.User>(api.patch('/me', { name })),
  analytics: (month?: string) => d<T.UserAnalytics>(api.get('/me/analytics', { params: month ? { month } : undefined })),
};

export const friends = {
  list: () => d<T.Friend[]>(api.get('/friends')),
  search: (q: string) => d<T.Friend[]>(api.get('/friends/search', { params: { q } })),
  add: (userId: string) => d<T.Friend>(api.post('/friends', { userId })),
};

export const devices = {
  save: (fcmToken: string, platform: 'ANDROID' | 'IOS') => api.post('/devices', { fcmToken, platform }),
};

export const notifications = {
  list: () => d<T.NotificationPage>(api.get('/notifications', { params: { size: 50 } })),
  readAll: () => api.post('/notifications/read-all'),
};

export const trips = {
  list: () => d<T.TripSummary[]>(api.get('/trips')),
  get: (id: string) => d<T.TripDetail>(api.get(`/trips/${id}`)),
  create: (body: { name: string; destination?: string; startDate?: string; endDate?: string; currency?: string; guestNames: string[] }) =>
    d<T.TripDetail>(api.post('/trips', body)),
  remove: (id: string) => api.delete(`/trips/${id}`),
  leave: (id: string) => api.post(`/trips/${id}/leave`),
  addGuest: (id: string, name: string) => d<T.Member>(api.post(`/trips/${id}/members`, { name })),
  rename: (id: string, memberId: string, name: string) => d<T.Member>(api.patch(`/trips/${id}/members/${memberId}`, { name })),
  removeMember: (id: string, memberId: string) => api.delete(`/trips/${id}/members/${memberId}`),
  unlink: (id: string, memberId: string) => d<T.Member>(api.post(`/trips/${id}/members/${memberId}/unlink`)),
  resetInvite: (id: string) => d<{ inviteCode: string }>(api.post(`/trips/${id}/invite-link/reset`)),
  approve: (id: string, memberId: string) => d<T.TripDetail>(api.post(`/trips/${id}/join-requests/${memberId}/approve`)),
  reject: (id: string, memberId: string) => d<T.TripDetail>(api.post(`/trips/${id}/join-requests/${memberId}/reject`)),
  joinPreview: (code: string) => d<T.JoinPreview>(api.get(`/join/${encodeURIComponent(code)}`)),
  join: (code: string, claimMemberId: string | null) =>
    d<T.JoinResult>(api.post(`/join/${encodeURIComponent(code)}`, { claimMemberId })),
  uploadExcel: (id: string, file: { uri: string; name: string; mimeType: string }) => {
    const form = new FormData();
    form.append('file', file as any);
    return api.post(`/trips/${id}/import`, form, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
};

export const ledger = {
  expenses: (id: string, page: number) => d<T.ExpensePage>(api.get(`/trips/${id}/expenses`, { params: { page, size: 30 } })),
  createExpense: (id: string, body: T.ExpenseInput) => d<T.Expense>(api.post(`/trips/${id}/expenses`, body)),
  updateExpense: (id: string, expenseId: string, body: T.ExpenseInput) => d<T.Expense>(api.put(`/trips/${id}/expenses/${expenseId}`, body)),
  deleteExpense: (id: string, expenseId: string) => api.delete(`/trips/${id}/expenses/${expenseId}`),
  activities: (id: string) => d<T.ActivityPage>(api.get(`/trips/${id}/activities`, { params: { size: 100 } })),
  comment: (id: string, message: string, query: boolean, expenseId?: string) =>
    d<T.Activity>(api.post(`/trips/${id}/comments`, { message, query, expenseId: expenseId ?? null })),
  balances: (id: string) => d<T.Balances>(api.get(`/trips/${id}/balances`)),
  stats: (id: string) => d<T.Stats>(api.get(`/trips/${id}/stats`)),
  recordSettlement: (id: string, body: { requestId: string; fromMember: string; toMember: string; amount: string }) =>
    d<T.Settlement>(api.post(`/trips/${id}/settlements`, body)),
  markSettled: (id: string) => d<T.Balances>(api.post(`/trips/${id}/settle`)),
  reopen: (id: string) => d<T.Balances>(api.post(`/trips/${id}/reopen`)),
};
