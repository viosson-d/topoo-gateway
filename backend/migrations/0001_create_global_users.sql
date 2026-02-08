-- Migration number: 0001 	 2024-05-23T00:00:00.000Z
DROP TABLE IF EXISTS global_users;

CREATE TABLE global_users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    google_id TEXT,
    nickname TEXT,
    avatar_url TEXT,
    created_at INTEGER,
    updated_at INTEGER
);

CREATE INDEX idx_global_users_email ON global_users(email);
