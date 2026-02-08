import { Env, JWTPayload } from './types';

// Simple JWT implementation (in production, use a library like jose)
export async function generateJWT(payload: Omit<JWTPayload, 'iat' | 'exp'>, secret: string): Promise<string> {
    const header = { alg: 'HS256', typ: 'JWT' };
    const now = Math.floor(Date.now() / 1000);
    const fullPayload: JWTPayload = {
        ...payload,
        iat: now,
        exp: now + 30 * 24 * 60 * 60, // 30 days
    };

    const encodedHeader = btoa(JSON.stringify(header));
    const encodedPayload = btoa(JSON.stringify(fullPayload));
    const message = `${encodedHeader}.${encodedPayload}`;

    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
        'raw',
        encoder.encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
    );

    const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(message));
    const encodedSignature = btoa(String.fromCharCode(...new Uint8Array(signature)));

    return `${message}.${encodedSignature}`;
}

export async function verifyJWT(token: string, secret: string): Promise<JWTPayload | null> {
    try {
        const [encodedHeader, encodedPayload, encodedSignature] = token.split('.');
        const message = `${encodedHeader}.${encodedPayload}`;

        const encoder = new TextEncoder();
        const key = await crypto.subtle.importKey(
            'raw',
            encoder.encode(secret),
            { name: 'HMAC', hash: 'SHA-256' },
            false,
            ['verify']
        );

        const signature = Uint8Array.from(atob(encodedSignature), c => c.charCodeAt(0));
        const isValid = await crypto.subtle.verify('HMAC', key, signature, encoder.encode(message));

        if (!isValid) return null;

        const payload: JWTPayload = JSON.parse(atob(encodedPayload));

        // Check expiration
        if (payload.exp < Math.floor(Date.now() / 1000)) {
            return null;
        }

        return payload;
    } catch {
        return null;
    }
}

export function generateId(): string {
    return crypto.randomUUID();
}
