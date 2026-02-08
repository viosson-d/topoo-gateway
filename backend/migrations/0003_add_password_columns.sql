-- Migration number: 0003 	 2024-05-24T00:00:00.000Z
ALTER TABLE global_users ADD COLUMN password_hash TEXT;
ALTER TABLE global_users ADD COLUMN salt TEXT;
