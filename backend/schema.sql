-- 1. 全局用户表 (核心, 所有产品通用)
CREATE TABLE IF NOT EXISTS global_users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    google_id TEXT UNIQUE,
    nickname TEXT,
    avatar_url TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

-- 2. 产品定义 (系统级枚举)
CREATE TABLE IF NOT EXISTS products (
    code TEXT PRIMARY KEY, -- e.g., 'p16-gateway', 'p13-memory'
    name TEXT NOT NULL,
    description TEXT
);

-- 初始化产品数据 (如果不存在)
INSERT OR IGNORE INTO products (code, name, description) VALUES 
('p16-gateway', 'Topoo Gateway', 'High-performance AI Gateway with quota management'),
('p13-memory', 'Topoo Memory Hub', 'Personal AI Memory Storage'),
('p14-desktop', 'Topoo Desktop', 'Unified AI Workspace');

-- 3. 用户权益/订阅许可 (连接 用户-产品)
-- 一个用户可以对不同产品有不同的权益等级
CREATE TABLE IF NOT EXISTS licenses (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    product_code TEXT NOT NULL,
    plan_tier TEXT DEFAULT 'free', -- free, pro, team, enterprise
    status TEXT DEFAULT 'active',  -- active, expired, suspended
    expires_at INTEGER,            -- NULL 表示永久有效/自动续费中
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES global_users(id) ON DELETE CASCADE,
    FOREIGN KEY (product_code) REFERENCES products(code)
);

-- 4. P16 专用: 配额与使用统计
-- 与 licenses 1:1 关联, 但作为独立业务表存在
CREATE TABLE IF NOT EXISTS p16_usage_stats (
    user_id TEXT PRIMARY KEY,
    current_period_start INTEGER NOT NULL, -- 当前计费周期开始时间
    current_period_end INTEGER NOT NULL,   -- 当前计费周期结束时间
    token_quota_limit INTEGER DEFAULT 100000,
    tokens_consumed INTEGER DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES global_users(id) ON DELETE CASCADE
);

-- 5. P16 专用: 使用日志 (流水)
CREATE TABLE IF NOT EXISTS p16_access_logs (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    model_name TEXT NOT NULL,
    tokens INTEGER NOT NULL,
    timestamp INTEGER NOT NULL,
    request_id TEXT,
    FOREIGN KEY (user_id) REFERENCES global_users(id) ON DELETE CASCADE
);

-- 6. P16 专用: API 密钥
CREATE TABLE IF NOT EXISTS p16_api_keys (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    key_hash TEXT UNIQUE NOT NULL,
    name TEXT,
    permissions TEXT DEFAULT 'read', -- read, write, admin (JSON or simple string)
    created_at INTEGER NOT NULL,
    last_used_at INTEGER,
    FOREIGN KEY (user_id) REFERENCES global_users(id) ON DELETE CASCADE
);

-- 索引优化
CREATE INDEX IF NOT EXISTS idx_licenses_user_product ON licenses(user_id, product_code);
CREATE INDEX IF NOT EXISTS idx_p16_logs_user_time ON p16_access_logs(user_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_p16_api_keys_hash ON p16_api_keys(key_hash);
