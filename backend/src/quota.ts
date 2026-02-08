import { Env, P16UsageStats, License } from './types';
import { generateId, verifyJWT } from './utils';

export async function handleQuota(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // Verify JWT
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    const token = authHeader.substring(7);
    const payload = await verifyJWT(token, env.JWT_SECRET);

    if (!payload) {
        return new Response(JSON.stringify({ error: 'Invalid token' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    if (path === '/api/quota/current' && request.method === 'GET') {
        return handleGetQuota(payload.user_id, env);
    }

    if (path === '/api/quota/consume' && request.method === 'POST') {
        return handleConsumeQuota(request, payload.user_id, env);
    }

    if (path === '/api/quota/history' && request.method === 'GET') {
        return handleGetHistory(payload.user_id, env);
    }

    return new Response('Not Found', { status: 404 });
}

async function handleGetQuota(userId: string, env: Env): Promise<Response> {
    try {
        // 1. Get current P16 license for plan info (though logic mainly uses stats now)
        const license = await env.DB.prepare(
            'SELECT * FROM licenses WHERE user_id = ? AND product_code = ? AND status = ?'
        )
            .bind(userId, 'p16-gateway', 'active')
            .first<License>();

        if (!license) {
            return new Response(JSON.stringify({ error: 'No active P16 license' }), {
                status: 403,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // 2. Get usage stats
        const stats = await env.DB.prepare(
            'SELECT * FROM p16_usage_stats WHERE user_id = ?'
        )
            .bind(userId)
            .first<P16UsageStats>();

        if (!stats) {
            return new Response(JSON.stringify({ error: 'No usage stats record found' }), {
                status: 404,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // 3. Check reset
        const now = Date.now();
        if (now >= stats.current_period_end) {
            const nextEnd = new Date(now);
            nextEnd.setMonth(nextEnd.getMonth() + 1);

            await env.DB.prepare(
                'UPDATE p16_usage_stats SET tokens_consumed = 0, current_period_start = ?, current_period_end = ?, updated_at = ? WHERE user_id = ?'
            )
                .bind(now, nextEnd.getTime(), now, userId)
                .run();

            stats.tokens_consumed = 0;
            stats.current_period_start = now;
            stats.current_period_end = nextEnd.getTime();
        }

        return new Response(JSON.stringify({
            subscription: {
                ...license,
                quota_limit: stats.token_quota_limit,
                quota_used: stats.tokens_consumed,
                quota_reset_at: stats.current_period_end
            }
        }), {
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (error) {
        return new Response(JSON.stringify({ error: 'Internal server error' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}

async function handleConsumeQuota(request: Request, userId: string, env: Env): Promise<Response> {
    try {
        const { model, tokens } = await request.json();

        if (!model || !tokens || tokens <= 0) {
            return new Response(JSON.stringify({ error: 'Invalid request' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        const stats = await env.DB.prepare(
            'SELECT * FROM p16_usage_stats WHERE user_id = ?'
        )
            .bind(userId)
            .first<P16UsageStats>();

        if (!stats) {
            return new Response(JSON.stringify({ error: 'No usage stats found' }), {
                status: 404,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // Check quota
        const newUsed = stats.tokens_consumed + tokens;
        if (newUsed > stats.token_quota_limit) {
            return new Response(JSON.stringify({ error: 'Quota exceeded' }), {
                status: 429,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        const now = Date.now();

        // Update quota
        await env.DB.prepare(
            'UPDATE p16_usage_stats SET tokens_consumed = ?, updated_at = ? WHERE user_id = ?'
        )
            .bind(newUsed, now, userId)
            .run();

        // Log usage
        const logId = generateId();
        await env.DB.prepare(
            'INSERT INTO p16_access_logs (id, user_id, model_name, tokens, timestamp) VALUES (?, ?, ?, ?, ?)'
        )
            .bind(logId, userId, model, tokens, now)
            .run();

        return new Response(JSON.stringify({ success: true, quota_remaining: stats.token_quota_limit - newUsed }), {
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (error) {
        console.error(error);
        return new Response(JSON.stringify({ error: 'Internal server error' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}

async function handleGetHistory(userId: string, env: Env): Promise<Response> {
    try {
        const logs = await env.DB.prepare(
            'SELECT * FROM p16_access_logs WHERE user_id = ? ORDER BY timestamp DESC LIMIT 100'
        )
            .bind(userId)
            .all();

        return new Response(JSON.stringify({ logs: logs.results || [] }), {
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (error) {
        return new Response(JSON.stringify({ error: 'Internal server error' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}
