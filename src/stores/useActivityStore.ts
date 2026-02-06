import { create } from 'zustand';
import { request as invoke } from '../utils/request';


// New Data Structures for Gateway Communication
export type Role = 'engineer' | 'agent';

export interface MessageNode {
    id: string;
    role: Role;
    name: string;
    avatar?: string; // Optional custom avatar URL
    status: 'pending' | 'success' | 'error';
    timestamp: number;
    channel: string; // e.g., 'wechat', 'slack', 'cli'
    content?: string; // Content of the message
}

export interface CommunicationTurn {
    id: string;
    nodes: MessageNode[]; // Ordered flow: Engineer -> Agent
}

export interface DailyUsage {
    date: string;
    claude: number;
    gemini: number;
    sessions: number;
}

interface ActivityState {
    turns: CommunicationTurn[]; // Replaces generic 'events'
    usageHistory: DailyUsage[];
    granularity: 'minute' | 'hour' | 'day';
    loading: boolean;
    error: string | null;
    setGranularity: (granularity: 'minute' | 'hour' | 'day') => void;
    fetchUsageHistory: () => Promise<void>;
    fetchRecentActivity: () => Promise<void>;
    setupListeners: () => Promise<() => void>;
}

/**
 * 将 ProxyRequestLog 转换为 CommunicationTurn
 * 从请求和响应中提取用户消息和 AI 响应
 */
function mapLogToTurn(log: any): CommunicationTurn | null {
    try {
        // 基本验证
        if (!log || !log.id) {
            console.warn('[mapLogToTurn] Invalid log: missing id');
            return null;
        }

        console.log('[mapLogToTurn] Processing log:', {
            id: log.id,
            hasRequestBody: !!log.request_body,
            hasResponseBody: !!log.response_body,
            hasError: !!log.error,
            status: log.status
        });

        const nodes: MessageNode[] = [];

        // 提取用户请求内容
        let userContent = '';
        if (log.request_body) {
            try {
                const reqBody = typeof log.request_body === 'string'
                    ? JSON.parse(log.request_body)
                    : log.request_body;

                console.log('[mapLogToTurn] Parsed request_body:', reqBody);

                // 支持 OpenAI 和 Anthropic 格式
                if (reqBody.messages && Array.isArray(reqBody.messages)) {
                    const lastUserMsg = reqBody.messages
                        .filter((m: any) => m.role === 'user')
                        .pop();

                    if (lastUserMsg) {
                        if (typeof lastUserMsg.content === 'string') {
                            userContent = lastUserMsg.content;
                        } else if (Array.isArray(lastUserMsg.content)) {
                            // 处理多模态内容
                            userContent = lastUserMsg.content
                                .filter((c: any) => c.type === 'text')
                                .map((c: any) => c.text)
                                .join(' ');
                        }
                    }
                }
            } catch (e) {
                console.error('[mapLogToTurn] Failed to parse request_body:', e, log.request_body);
            }
        }

        // 添加用户节点
        if (userContent) {
            nodes.push({
                id: `${log.id}-user`,
                role: 'engineer',
                name: log.account_email || 'User',
                status: 'success',
                timestamp: log.timestamp,
                channel: log.protocol || 'api',
                content: userContent.length > 200 ? userContent.substring(0, 200) + '...' : userContent
            });
        }

        // 提取 AI 响应内容
        let assistantContent = '';
        if (log.response_body) {
            try {
                const resBody = typeof log.response_body === 'string'
                    ? JSON.parse(log.response_body)
                    : log.response_body;

                console.log('[mapLogToTurn] Parsed response_body:', resBody);

                // OpenAI 格式
                if (resBody.choices && Array.isArray(resBody.choices) && resBody.choices.length > 0) {
                    const choice = resBody.choices[0];
                    if (choice.message && choice.message.content) {
                        assistantContent = choice.message.content;
                    } else if (choice.delta && choice.delta.content) {
                        assistantContent = choice.delta.content;
                    }
                }
                // Anthropic 格式
                else if (resBody.content && Array.isArray(resBody.content)) {
                    assistantContent = resBody.content
                        .filter((c: any) => c.type === 'text')
                        .map((c: any) => c.text)
                        .join(' ');
                }
            } catch (e) {
                console.error('[mapLogToTurn] Failed to parse response_body:', e, log.response_body);
            }
        }

        // 处理错误信息 - 只显示简短的错误摘要
        let errorSummary = '';
        if (log.error) {
            try {
                // 如果 error 是 JSON 字符串,尝试解析并提取关键信息
                const errorObj = typeof log.error === 'string' ? JSON.parse(log.error) : log.error;
                if (errorObj.error && errorObj.error.message) {
                    errorSummary = errorObj.error.message;
                } else if (errorObj.message) {
                    errorSummary = errorObj.message;
                } else {
                    errorSummary = String(log.error).substring(0, 100);
                }
            } catch {
                // 如果不是 JSON,直接截取前100个字符
                errorSummary = String(log.error).substring(0, 100);
            }
        }

        // 添加 AI 节点
        const modelName = log.mapped_model || log.model || 'AI';
        nodes.push({
            id: `${log.id}-assistant`,
            role: 'agent',
            name: modelName,
            status: log.status >= 200 && log.status < 300 ? 'success' : 'error',
            timestamp: log.timestamp + (log.duration || 0),
            channel: log.protocol || 'api',
            content: assistantContent
                ? (assistantContent.length > 200 ? assistantContent.substring(0, 200) + '...' : assistantContent)
                : (errorSummary || 'No response')
        });

        console.log('[mapLogToTurn] Created nodes:', nodes);

        // 如果没有任何有效节点,返回 null
        if (nodes.length === 0) {
            return null;
        }

        return {
            id: log.id,
            nodes
        };
    } catch (error) {
        console.error('[mapLogToTurn] Error mapping log:', error, log);
        return null;
    }
}

export const useActivityStore = create<ActivityState>()(
    (set, get) => ({
        turns: [],
        usageHistory: [],
        granularity: 'day', // Default to day
        loading: false,
        error: null,

        setGranularity: (granularity) => {
            set({ granularity });
            get().fetchUsageHistory();
        },

        fetchUsageHistory: async () => {
            set({ loading: true, error: null });
            try {
                const { granularity } = get();
                let trendData: any[] = [];

                if (granularity === 'minute') {
                    // Fetch last 60 minutes
                    trendData = await invoke('get_token_stats_model_trend_minute', { minutes: 60 });
                } else if (granularity === 'hour') {
                    // Fetch last 24 hours
                    trendData = await invoke('get_token_stats_model_trend_hourly', { hours: 24 });
                } else {
                    // Fetch last 14 days
                    trendData = await invoke('get_token_stats_model_trend_daily', { days: 14 });
                }

                const history: DailyUsage[] = trendData.map(point => {
                    // Aggregate all accounts for Claude and Gemini
                    let claudeTotal = 0;
                    let geminiTotal = 0;

                    if (point.model_data) {
                        Object.entries(point.model_data).forEach(([name, tokens]: [string, any]) => {
                            const lowerName = name.toLowerCase();
                            if (lowerName.includes('claude') || lowerName.includes('anthropic')) {
                                claudeTotal += tokens;
                            } else if (lowerName.includes('gemini') || lowerName.includes('google')) {
                                geminiTotal += tokens;
                            }
                        });
                    }

                    return {
                        date: point.period,
                        claude: claudeTotal,
                        gemini: geminiTotal,
                        sessions: 0
                    };
                });

                set({ usageHistory: history, loading: false });
            } catch (err) {
                console.error('[Store] Fetch usage history failed:', err);
                set({ error: String(err), loading: false });
            }
        },

        fetchRecentActivity: async () => {
            set({ loading: true, error: null });
            try {
                // Fetch latest 20 logs
                const logs: any[] = await invoke('get_proxy_logs_paginated', {
                    page: 0,
                    pageSize: 20
                });

                // Map ProxyRequestLog to CommunicationTurn
                const turns: CommunicationTurn[] = logs
                    .map(mapLogToTurn)
                    .filter((t): t is CommunicationTurn => t !== null);

                set({ turns, loading: false });
            } catch (err) {
                console.error('[Store] Fetch recent activity failed:', err);
                set({ error: String(err), loading: false });
            }
        },

        setupListeners: async () => {
            try {
                // Dynamic import to avoid initialization issues
                const { listen } = await import('@tauri-apps/api/event');
                console.log('[Store] Event API loaded dynamically');

                const handler = (event: any) => {
                    console.log('[Store] Received realtime log (raw):', event);
                    try {
                        const payload = event.payload;
                        if (!payload) {
                            console.warn('[Store] Received empty payload');
                            return;
                        }

                        // console.log('[Store] Processing payload:', payload); 
                        // Reduce console spam
                        const newTurn = mapLogToTurn(payload);

                        // If mapLogToTurn returned null (e.g. invalid debug event), ignore it
                        if (!newTurn) return;

                        set((state) => {
                            // Check for duplicates
                            if (state.turns.some(t => t.id === newTurn.id)) {
                                return state;
                            }
                            // Prepend new turn and limit to 50
                            const updatedTurns = [newTurn, ...state.turns].slice(0, 50);
                            return { turns: updatedTurns };
                        });

                        // Also refresh usage history to update the chart
                        get().fetchUsageHistory().catch((err: unknown) =>
                            console.error('[Store] Auto-refresh usage history failed:', err)
                        );
                    } catch (innerErr) {
                        console.error('[Store] Error processing event payload:', innerErr);
                    }
                };

                // Listen to both standard and simplified event names
                const unlistenStandard = await listen<any>('proxy://request', handler);
                const unlistenSimple = await listen<any>('proxy-request', handler);

                console.log('[Store] Event listeners attached successfully (Standard & Simple)');

                return () => {
                    unlistenStandard();
                    unlistenSimple();
                };
            } catch (err) {
                console.error('[Store] Failed to setup event listener:', err);
                return () => { };
            }
        }
    })
);
