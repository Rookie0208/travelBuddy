-- Amounts are stored as whole paise (BIGINT). Never floating point.

CREATE TABLE users (
  id             UUID PRIMARY KEY,
  name           VARCHAR(100) NOT NULL,
  email          VARCHAR(255) NOT NULL UNIQUE,
  password_hash  VARCHAR(100) NOT NULL,
  email_verified BOOLEAN NOT NULL DEFAULT FALSE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE refresh_tokens (
  id         UUID PRIMARY KEY,
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(100) NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE email_codes (
  id         UUID PRIMARY KEY,
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code_hash  VARCHAR(100) NOT NULL,
  attempts   INT NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE device_tokens (
  id        UUID PRIMARY KEY,
  user_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  fcm_token VARCHAR(512) NOT NULL UNIQUE,
  platform  VARCHAR(10) NOT NULL CHECK (platform IN ('ANDROID','IOS'))
);

CREATE TABLE trips (
  id          UUID PRIMARY KEY,
  name        VARCHAR(100) NOT NULL,
  destination VARCHAR(100),
  start_date  DATE,
  end_date    DATE,
  notes       TEXT,
  currency    VARCHAR(3) NOT NULL DEFAULT 'INR',
  invite_code VARCHAR(64) NOT NULL UNIQUE,
  status      VARCHAR(10) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','SETTLED')),
  created_by  UUID NOT NULL,              -- no FK on purpose: account deletion must not break trips
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at  TIMESTAMPTZ,
  CHECK (end_date IS NULL OR start_date IS NULL OR end_date >= start_date)
);

-- A member is a person inside ONE trip. user_id NULL = guest (no app account).
-- status PENDING = someone asked to join through the invite link and waits for the owner.
CREATE TABLE members (
  id              UUID PRIMARY KEY,
  trip_id         UUID NOT NULL REFERENCES trips(id),
  user_id         UUID REFERENCES users(id),
  name            VARCHAR(100) NOT NULL,
  role            VARCHAR(10) NOT NULL DEFAULT 'MEMBER' CHECK (role IN ('OWNER','MEMBER')),
  status          VARCHAR(10) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','PENDING')),
  claim_member_id UUID,                   -- PENDING only: the guest name this person says they are
  left_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (trip_id, id),                   -- lets other tables reference (trip_id, member_id)
  UNIQUE (trip_id, user_id)               -- an account appears only once per trip
);
CREATE UNIQUE INDEX one_owner_per_trip ON members(trip_id) WHERE role = 'OWNER';
CREATE INDEX idx_members_user ON members(user_id);

CREATE TABLE expenses (
  id           UUID PRIMARY KEY,
  trip_id      UUID NOT NULL REFERENCES trips(id),
  paid_by      UUID NOT NULL,
  amount_paise BIGINT NOT NULL CHECK (amount_paise > 0),
  title        VARCHAR(150) NOT NULL,
  category     VARCHAR(30) NOT NULL DEFAULT 'OTHER',
  expense_date DATE NOT NULL,
  request_id   UUID NOT NULL,             -- sent by the app; stops duplicates when a request is retried
  version      BIGINT NOT NULL DEFAULT 0, -- optimistic locking
  created_by   UUID NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at   TIMESTAMPTZ,
  UNIQUE (trip_id, id),
  UNIQUE (trip_id, request_id),
  FOREIGN KEY (trip_id, paid_by)    REFERENCES members(trip_id, id),
  FOREIGN KEY (trip_id, created_by) REFERENCES members(trip_id, id)
);
CREATE INDEX idx_expenses_trip_date ON expenses(trip_id, expense_date DESC);

CREATE TABLE expense_splits (
  id          UUID PRIMARY KEY,
  expense_id  UUID NOT NULL,
  trip_id     UUID NOT NULL,
  member_id   UUID NOT NULL,
  share_paise BIGINT NOT NULL CHECK (share_paise >= 0),
  UNIQUE (expense_id, member_id),
  FOREIGN KEY (trip_id, expense_id) REFERENCES expenses(trip_id, id),
  FOREIGN KEY (trip_id, member_id)  REFERENCES members(trip_id, id)
);
CREATE INDEX idx_splits_expense ON expense_splits(expense_id);

CREATE TABLE settlements (
  id           UUID PRIMARY KEY,
  trip_id      UUID NOT NULL REFERENCES trips(id),
  from_member  UUID NOT NULL,             -- who paid back
  to_member    UUID NOT NULL,             -- who received
  amount_paise BIGINT NOT NULL CHECK (amount_paise > 0),
  request_id   UUID NOT NULL,
  created_by   UUID NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (trip_id, request_id),
  CHECK (from_member <> to_member),
  FOREIGN KEY (trip_id, from_member) REFERENCES members(trip_id, id),
  FOREIGN KEY (trip_id, to_member)   REFERENCES members(trip_id, id)
);

-- Ledger history + comments + queries. Messages are saved as text at the time of the event.
CREATE TABLE activities (
  id         UUID PRIMARY KEY,
  trip_id    UUID NOT NULL REFERENCES trips(id),
  actor_id   UUID,
  type       VARCHAR(30) NOT NULL,
  expense_id UUID,
  message    TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_activities_trip_time ON activities(trip_id, created_at DESC);

-- In-app notifications for registered users.
CREATE TABLE notifications (
  id         UUID PRIMARY KEY,
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  trip_id    UUID,
  message    TEXT NOT NULL,
  seen       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_notifications_user ON notifications(user_id, created_at DESC);
