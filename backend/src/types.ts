export interface Env {
    DB: D1Database;
    JWT_SECRET: string;
    GOOGLE_CLIENT_ID: string;
    GOOGLE_CLIENT_SECRET: string;
    GITHUB_CLIENT_ID: string;
    GITHUB_CLIENT_SECRET: string;
}

export interface GlobalUser {
    id: string;
    email: string;
    google_id?: string;
    password_hash?: string;
    salt?: string;
    nickname?: string;
    avatar_url?: string;
    created_at: number;
    updated_at: number;
}

export interface License {
    id: string;
    user_id: string;
    product_code: string;
    plan_tier: 'free' | 'pro' | 'team' | 'enterprise';
    status: 'active' | 'expired' | 'suspended';
    expires_at?: number;
    created_at: number;
    updated_at: number;
}

// P16 Specific Types
export interface P16UsageStats {
    user_id: string;
    current_period_start: number;
    current_period_end: number;
    token_quota_limit: number;
    tokens_consumed: number;
    created_at: number;
    updated_at: number;
}

export interface P16AccessLog {
    id: string;
    user_id: string;
    model_name: string;
    tokens: number;
    timestamp: number;
    request_id?: string;
}

export interface JWTPayload {
    user_id: string;
    email: string;
    iat: number;
    exp: number;
}

export interface GoogleTokenPayload {
    iss: string;
    sub: string;
    azp: string;
    aud: string;
    iat: string;
    exp: string;
    email: string;
    email_verified: string;
    name?: string;
    picture?: string;
    given_name?: string;
    family_name?: string;
    locale?: string;
}
