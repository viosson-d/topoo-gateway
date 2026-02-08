import { Env } from './types';
import { handleAuth } from './auth';
import { handleQuota } from './quota';

export default {
    async fetch(request: Request, env: Env): Promise<Response> {
        const url = new URL(request.url);

        // CORS headers
        const corsHeaders = {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        };

        // Handle OPTIONS request
        if (request.method === 'OPTIONS') {
            return new Response(null, { headers: corsHeaders });
        }

        try {
            let response: Response;

            // Route requests
            if (url.pathname.startsWith('/api/auth')) {
                response = await handleAuth(request, env);
            } else if (url.pathname.startsWith('/api/quota')) {
                response = await handleQuota(request, env);
            } else {
                response = new Response('Not Found', { status: 404 });
            }

            // Add CORS headers to response
            Object.entries(corsHeaders).forEach(([key, value]) => {
                response.headers.set(key, value);
            });

            return response;
        } catch (error) {
            const errorResponse = new Response(JSON.stringify({ error: 'Internal server error' }), {
                status: 500,
                headers: { 'Content-Type': 'application/json', ...corsHeaders },
            });
            return errorResponse;
        }
    },
};
