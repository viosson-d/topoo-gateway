-- Migration number: 0004 	 2024-05-24T00:00:00.000Z
CREATE TABLE IF NOT EXISTS access_requests (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL,
    reason TEXT,
    status TEXT DEFAULT 'pending',
    created_at INTEGER DEFAULT (strftime('%s', 'now'))
);
