export const schema = [
  `CREATE TABLE IF NOT EXISTS accounts (
    id TEXT PRIMARY KEY NOT NULL,
    username TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    password_hash TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS auth_sessions (
    token_hash TEXT PRIMARY KEY NOT NULL,
    account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    expires INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS auth_sessions_expiry ON auth_sessions(expires);
  CREATE TABLE IF NOT EXISTS auth_attempts (
    scope TEXT NOT NULL,
    attempted INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS auth_attempts_scope ON auth_attempts(scope, attempted);
  CREATE TABLE IF NOT EXISTS rooms (
    id TEXT PRIMARY KEY NOT NULL,
    invite TEXT UNIQUE NOT NULL,
    owner TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS members (
    user TEXT PRIMARY KEY NOT NULL,
    room TEXT NOT NULL REFERENCES rooms(id),
    name TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS members_room ON members(room);
  CREATE TABLE IF NOT EXISTS entries (
    owner TEXT NOT NULL,
    id TEXT NOT NULL,
    kind TEXT NOT NULL CHECK(kind IN ('plan', 'draft', 'log', 'cheer')),
    payload TEXT NOT NULL,
    updated TEXT NOT NULL,
    PRIMARY KEY(owner, id)
  );`,
  `CREATE TABLE IF NOT EXISTS workout_heart (
    owner TEXT NOT NULL,
    workout_id TEXT NOT NULL,
    payload TEXT NOT NULL,
    PRIMARY KEY(owner, workout_id),
    FOREIGN KEY(owner, workout_id) REFERENCES entries(owner, id) ON DELETE CASCADE
  );`,
  `CREATE TABLE IF NOT EXISTS apple_health_link (
    owner TEXT PRIMARY KEY NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    code_hash TEXT UNIQUE,
    code_expires INTEGER,
    token_hash TEXT UNIQUE
  );`,
  `CREATE TABLE IF NOT EXISTS health_body_mass (
    owner TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    sample_id TEXT NOT NULL,
    at INTEGER NOT NULL,
    payload TEXT NOT NULL,
    PRIMARY KEY(owner, sample_id)
  );
  CREATE TABLE IF NOT EXISTS health_workout (
    owner TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    sample_id TEXT NOT NULL,
    started INTEGER NOT NULL,
    payload TEXT NOT NULL,
    PRIMARY KEY(owner, sample_id)
  );
  CREATE TABLE IF NOT EXISTS health_activity (
    owner TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    date TEXT NOT NULL,
    payload TEXT NOT NULL,
    PRIMARY KEY(owner, date)
  );
  CREATE TABLE IF NOT EXISTS health_sync_status (
    owner TEXT PRIMARY KEY NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    payload TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS apple_heart_sync (
    owner TEXT NOT NULL,
    workout_id TEXT NOT NULL,
    PRIMARY KEY(owner, workout_id),
    FOREIGN KEY(owner, workout_id) REFERENCES workout_heart(owner, workout_id) ON DELETE CASCADE
  );`,
];
