import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { invoke } from '@tauri-apps/api/core';

// Define interfaces locally
export interface GlobalUser {
    id: string;
    email: string;
    google_id?: string;
    nickname?: string;
    avatar_url?: string;
    created_at: number;
    updated_at: number;
    plan?: string;
}

export interface P16UsageStats {
    user_id: string;
    current_period_start: number;
    current_period_end: number;
    token_quota_limit: number;
    tokens_consumed: number;
    created_at: number;
    updated_at: number;
}

interface UserState {
    user: GlobalUser | null;
    token: string | null;
    quota: P16UsageStats | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    error: string | null;

    // Actions
    login: (inviteCode?: string) => Promise<void>; // Google Login
    loginWithEmail: (email: string, password: string) => Promise<void>;
    registerWithEmail: (email: string, password: string, inviteCode: string) => Promise<void>;
    logout: () => void;
    checkAuth: () => Promise<void>;
    fetchQuota: () => Promise<void>;
    setUser: (user: GlobalUser | null, token: string | null) => void;
    clearError: () => void;
    submitAccessRequest: (email: string, reason: string) => Promise<void>;
}

export const BACKEND_URL = 'https://p16-backend.wissen-damon.workers.dev';

export const useUserStore = create<UserState>()(
    persist(
        (set, get) => ({
            user: null,
            token: null,
            quota: null,
            isAuthenticated: false,
            isLoading: false,
            error: null,

            setUser: (user, token) => set({ user, token, isAuthenticated: !!user }),

            submitAccessRequest: async (email: string, reason: string) => {
                set({ isLoading: true, error: null });
                try {
                    const response = await fetch(`${BACKEND_URL}/api/auth/access-request`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email, reason }),
                    });

                    if (!response.ok) {
                        const data = await response.json().catch(() => ({}));
                        throw new Error(data.error || 'Submission failed');
                    }
                } catch (err: any) {
                    set({ error: err.message });
                    throw err;
                } finally {
                    set({ isLoading: false });
                }
            },

            login: async (inviteCode?: string) => {
                set({ isLoading: true, error: null });
                try {
                    console.log('Starting Google login flow...');
                    const response = await invoke('login_topoo_user');
                    console.log('Rust login response:', response);

                    // @ts-ignore
                    const { id_token } = response;

                    if (!id_token) {
                        throw new Error('Failed to retrieve ID Token from Google');
                    }

                    const payload: any = { id_token };
                    if (inviteCode) {
                        payload.invite_code = inviteCode;
                    }

                    const authResponse = await fetch(`${BACKEND_URL}/api/auth/register`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload),
                    });

                    if (!authResponse.ok) {
                        const errorData = await authResponse.json().catch(() => ({}));
                        console.error('Backend registration failed:', authResponse.status, errorData);

                        if (authResponse.status === 403 && (errorData.error === 'INVITE_REQUIRED' || errorData.error === 'INVALID_INVITE_CODE')) {
                            // Re-throw specific error text to be caught by UI
                            throw new Error(errorData.error);
                        }
                        throw new Error(`Backend registration failed: ${authResponse.status}`);
                    }

                    const authData = await authResponse.json() as { token: string, user: GlobalUser };
                    set({
                        user: authData.user,
                        token: authData.token,
                        isAuthenticated: true,
                        isLoading: false
                    });

                    await get().fetchQuota();

                } catch (error: any) {
                    console.error('Google Login failed:', error);
                    let errorMessage = typeof error === 'string' ? error : error.message || 'Login failed';
                    set({ error: errorMessage, isLoading: false });
                    throw new Error(errorMessage);
                }
            },

            loginWithEmail: async (email, password) => {
                set({ isLoading: true, error: null });
                try {
                    const response = await fetch(`${BACKEND_URL}/api/auth/login`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email, password })
                    });

                    if (!response.ok) {
                        const data = await response.json().catch(() => ({}));
                        throw new Error(data.error || 'Login failed');
                    }

                    const data = await response.json() as { token: string, user: GlobalUser };
                    set({
                        user: data.user,
                        token: data.token,
                        isAuthenticated: true,
                        isLoading: false,
                    });

                    await get().fetchQuota();

                } catch (error: any) {
                    console.error('Email Login failed:', error);
                    set({ error: error.message, isLoading: false });
                    throw error;
                }
            },

            registerWithEmail: async (email, password, inviteCode) => {
                set({ isLoading: true, error: null });
                try {
                    const response = await fetch(`${BACKEND_URL}/api/auth/register`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email, password, invite_code: inviteCode })
                    });

                    if (!response.ok) {
                        const data = await response.json().catch(() => ({}));
                        throw new Error(data.error || 'Registration failed');
                    }

                    const data = await response.json() as { token: string, user: GlobalUser };
                    set({
                        user: data.user,
                        token: data.token,
                        isAuthenticated: true,
                        isLoading: false,
                    });

                    await get().fetchQuota();

                } catch (error: any) {
                    console.error('Registration failed:', error);
                    set({ error: error.message, isLoading: false });
                    throw error;
                }
            },

            logout: () => {
                set({ user: null, token: null, quota: null, isAuthenticated: false });
            },

            checkAuth: async () => {
                const { token } = get();
                if (!token) {
                    set({ isAuthenticated: false, user: null });
                    return;
                }

                try {
                    const response = await fetch(`${BACKEND_URL}/api/auth/verify`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        }
                    });

                    if (response.ok) {
                        const data = await response.json();
                        set({ user: data.user, isAuthenticated: true });
                    } else {
                        set({ user: null, token: null, isAuthenticated: false });
                    }
                } catch (e) {
                    console.error('Auth verification failed', e);
                }
            },

            fetchQuota: async () => {
                const { token, user } = get();
                if (!token || !user) return;

                try {
                    const response = await fetch(`${BACKEND_URL}/api/usage/stats?user_id=${user.id}`, {
                        headers: {
                            'Authorization': `Bearer ${token}`
                        }
                    });

                    if (response.ok) {
                        const data = await response.json() as { stats: P16UsageStats };
                        set({ quota: data.stats });
                    }
                } catch (error) {
                    console.error('Failed to fetch quota:', error);
                }
            },

            clearError: () => set({ error: null }),
        }),
        {
            name: 'p16-user-storage',
            partialize: (state) => ({
                user: state.user,
                token: state.token,
                isAuthenticated: state.isAuthenticated
            }),
        }
    )
);
