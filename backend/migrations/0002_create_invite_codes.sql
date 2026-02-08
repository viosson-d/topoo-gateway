-- Migration number: 0002 	 2024-05-23T00:00:00.000Z
DROP TABLE IF EXISTS invite_codes;

CREATE TABLE invite_codes (
    code TEXT PRIMARY KEY,
    is_used BOOLEAN DEFAULT FALSE,
    used_by TEXT,
    created_at INTEGER,
    used_at INTEGER
);

-- Index for faster lookup
CREATE INDEX idx_invite_codes_code ON invite_codes(code);

-- Insert some default invite codes for testing
INSERT INTO invite_codes (code, created_at) VALUES ('TOPOO-2024-TEST-01', 1716422400000);
INSERT INTO invite_codes (code, created_at) VALUES ('TOPOO-2024-TEST-02', 1716422400000);
INSERT INTO invite_codes (code, created_at) VALUES ('TOPOO-VIP-8888', 1716422400000);
