# TripSplit backend (v1)

Spring Boot 3 · Java 17 · PostgreSQL · Flyway · Spring Security + JWT

## Run it

```bash
# 1. database + api in Docker
docker compose up --build

# or: only the database in Docker (mapped to port 5434 by default to avoid conflicts), API from your machine
docker compose up db -d
./mvnw spring-boot:run
```

API base: `http://localhost:8080/api/v1`   Health: `http://localhost:8080/actuator/health`

**Email codes in development:** with `MAIL_ENABLED=false` (default) the 6-digit verification code is
printed in the server log (`[DEV MAIL] Verification code for ...`). You can also use `123456` in development.
Set `MAIL_ENABLED=true` and the `MAIL_*` variables to send real email.

**Push notifications:** off by default (they are only logged). To enable, create a Firebase project,
download a service-account JSON, then set `FCM_ENABLED=true` and `FCM_CREDENTIALS_PATH=/path/to/file.json`.

**Tests:** `mvn test` (unit tests for the split, balance and money logic).

## How it is organised

```
com.tripsplit
  model/      JPA entities (users, trips, members, expenses, expense_splits, settlements, activities ...)
  repo/       Spring Data repositories
  service/    business logic  (TripService, ExpenseService, MoneyService, ReportService, AuthService ...)
  web/        REST controllers + Dtos.java (all request/response shapes)
  security/   JWT, filters, Spring Security config
  common/     Money, SplitCalculator, BalanceCalculator, errors
db/migration/V1__init.sql   whole schema (Flyway)
```

## Key rules (all enforced in the backend)

- Money is `long` paise everywhere. Equal split gives the leftover paise, one each, to members in a stable order.
- `net = paid - share + repaid others - received repayments`. All nets add up to 0.
- A **member** is a person inside one trip. `user_id` empty = guest (no app).
- Joining: invite link -> request (PENDING) -> **owner approves**. A request may claim an existing guest name,
  which keeps all of that guest's history.
- Any current member can add/edit/delete expenses and write comments/queries. Only the owner manages
  members, the invite link, settlements and the settled status.
- Everything is logged as a history message (`activities`), saved as text at the time of the event.
- A user who is not an accepted member of a trip always gets `404` for it.

## Endpoints (`/api/v1`)

| Method | Path | Notes |
|---|---|---|
| POST | /auth/register, /auth/verify-email, /auth/resend-code, /auth/login, /auth/refresh, /auth/logout | public |
| GET / DELETE | /me | DELETE needs password |
| POST / DELETE | /devices | save / remove FCM token |
| GET, POST | /notifications, /notifications/read-all | in-app notifications |
| GET, POST | /trips | list mine / create (guestNames optional, currency optional, default INR) |
| GET, PATCH, DELETE | /trips/{id} | detail / edit / soft delete (owner) |
| POST, PATCH, DELETE | /trips/{id}/members[/{memberId}] | add guest / rename / remove (owner) |
| POST | /trips/{id}/members/{memberId}/unlink | owner |
| POST | /trips/{id}/leave | member |
| POST | /trips/{id}/invite-link/reset | owner |
| GET, POST | /join/{code} | preview / request to join (body: `{ "claimMemberId": "..." }` optional) |
| POST | /trips/{id}/join-requests/{memberId}/approve, /reject | owner |
| GET, POST | /trips/{id}/expenses | list (page,size,paidBy,category,from,to) / add |
| PUT, DELETE | /trips/{id}/expenses/{expenseId} | edit needs `version` / soft delete |
| GET | /trips/{id}/activities | history feed |
| POST | /trips/{id}/comments | `{ "message": "...", "query": true }` |
| GET | /trips/{id}/balances | balances + suggested repayments + settlements |
| POST | /trips/{id}/settlements | record repayment (owner) |
| POST | /trips/{id}/settle, /reopen | owner |
| GET | /trips/{id}/stats | totals by category and day |
| GET | /trips/{id}/export.xlsx | Excel (Summary, Settlement, Ledger, History) |

Errors: `{ "code": "...", "message": "..." }` with 400 / 401 / 403 / 404 / 409 / 429.

## Not in v1 (on purpose)

Real-time sync (the app refreshes on open / pull-to-refresh / push tap), custom split amounts,
multiple payers per expense, offline mode, personal (solo) expense tracker, SMS login.

## Notes before production

- Set a strong `JWT_SECRET` (32+ chars) and real DB credentials via environment variables.
- Put the API behind HTTPS (the platform load balancer is fine).
- The in-memory rate limiter is per instance; replace it if you run several instances.
- Refresh tokens are rotated; a reused old token is simply rejected.
