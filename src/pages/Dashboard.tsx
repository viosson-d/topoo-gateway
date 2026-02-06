import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshCw, AlertTriangle } from 'lucide-react';
import { useAccountStore } from '../stores/useAccountStore';
import { showToast } from '../components/common/ToastContainer';
import { cn } from '../lib/utils';
import AddAccountDialog from '../components/accounts/AddAccountDialog';
import { DashboardInsights } from '../components/dashboard/DashboardInsights';
import { UsageChart } from '../components/dashboard/UsageChart';
import { RecentActivity } from '../components/dashboard/RecentActivity';
import { ControlHub } from '../components/dashboard/ControlHub';
import { useActivityStore } from '../stores/useActivityStore';

import { PageHeader } from '../components/layout/PageHeader';
import { PageContainer } from '../components/layout/PageContainer';

function Dashboard() {
    const { t, i18n } = useTranslation();
    const {
        accounts,
        currentAccount,
        fetchAccounts,
        fetchCurrentAccount,
        addAccount,
        refreshQuota,
        error
    } = useAccountStore();

    const {
        fetchUsageHistory,
        fetchRecentActivity,
        setupListeners
    } = useActivityStore();

    useEffect(() => {
        fetchAccounts();
        fetchCurrentAccount();
        fetchUsageHistory();
        fetchRecentActivity();

        // Setup realtime listeners
        let unlisten: (() => void) | undefined;
        setupListeners().then(fn => {
            unlisten = fn;
        });

        return () => {
            if (unlisten) unlisten();
        };
    }, []);

    const stats = useMemo(() => {
        const geminiQuotas = accounts
            .map(a => a.quota?.models.find(m => m.name.toLowerCase() === 'gemini-3-pro-high')?.percentage || 0)
            .filter(q => q > 0);

        const claudeQuotas = accounts
            .map(a => a.quota?.models.find(m => m.name.toLowerCase() === 'claude-sonnet-4-5')?.percentage || 0)
            .filter(q => q > 0);

        const lowQuotaCount = accounts.filter(a => {
            if (a.quota?.is_forbidden) return false;
            const gemini = a.quota?.models.find(m => m.name.toLowerCase() === 'gemini-3-pro-high')?.percentage || 0;
            const claude = a.quota?.models.find(m => m.name.toLowerCase() === 'claude-sonnet-4-5')?.percentage || 0;
            return gemini < 10 || claude < 10;
        }).length;

        return {
            total: accounts.length,
            avgGemini: geminiQuotas.length ? Math.round(geminiQuotas.reduce((a, b) => a + b, 0) / geminiQuotas.length) : 0,
            avgClaude: claudeQuotas.length ? Math.round(claudeQuotas.reduce((a, b) => a + b, 0) / claudeQuotas.length) : 0,
            lowQuota: lowQuotaCount
        };
    }, [accounts]);

    const handleRefreshCurrent = async () => {
        if (!currentAccount) return;
        setIsRefreshing(true);
        try {
            await Promise.all([
                refreshQuota(currentAccount.id),
                fetchUsageHistory(),
                fetchRecentActivity()
            ]);
            await fetchCurrentAccount();
            showToast(t('dashboard.toast.refresh_success'), 'success');
        } catch (error) {
            showToast(`${t('dashboard.toast.refresh_error')}: ${error}`, 'error');
        } finally {
            setIsRefreshing(false);
        }
    };

    const handleAddAccount = async (email: string, refreshToken: string) => {
        await addAccount(email, refreshToken);
        await fetchAccounts();
    };

    const [isRefreshing, setIsRefreshing] = useState(false);

    return (
        <PageContainer className="select-none h-full overflow-y-auto">
            <PageHeader
                title="Dashboard"
                description={t('dashboard.updated_at', {
                    time: new Date().toLocaleString(i18n.language, {
                        month: 'short',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: 'numeric'
                    })
                })}
            >
                <AddAccountDialog onAdd={handleAddAccount} />
                <button
                    onClick={handleRefreshCurrent}
                    disabled={isRefreshing}
                    className="h-7 w-7 flex items-center justify-center p-0 hover:bg-zinc-100 dark:hover:bg-white/5 rounded-lg transition-all active:scale-95 border border-transparent hover:border-border/40"
                >
                    <RefreshCw className={cn("w-3.5 h-3.5 text-muted-foreground/35", isRefreshing && "animate-spin")} />
                </button>
            </PageHeader>

            <div className="flex flex-col flex-1 min-h-0 gap-4">
                {/* Error State Display: Only show big banner if no accounts are loaded */}
                {error && accounts.length === 0 && (
                    <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/50 rounded-lg p-3 flex items-center gap-3 text-sm text-red-600 dark:text-red-400 shrink-0">
                        <AlertTriangle className="w-4 h-4 shrink-0" />
                        <div className="flex-1">
                            <p className="font-medium">{t('dashboard.error.load_failed') || 'Data Load Error'}</p>
                            <p className="text-xs opacity-80">{error}</p>
                        </div>
                        <button
                            onClick={() => { fetchAccounts(); fetchCurrentAccount(); }}
                            className="px-3 py-1 rounded-md bg-white dark:bg-black/20 border border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-xs font-semibold"
                        >
                            {t('common.retry') || 'Retry'}
                        </button>
                    </div>
                )}

                {/* Smaller warning for transient errors when data exists */}
                {error && accounts.length > 0 && (
                    <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/50 rounded-lg py-2 px-3 flex items-center gap-2 text-xs text-amber-700 dark:text-amber-400 shrink-0">
                        <AlertTriangle className="w-3 h-3" />
                        <p className="flex-1">
                            {t('dashboard.error.sync_warning') || 'Some data failed to sync, showing cached data.'} ({error})
                        </p>
                        <button
                            onClick={() => { fetchAccounts(); fetchCurrentAccount(); }}
                            className="hover:underline font-medium"
                        >
                            {t('common.retry') || 'Retry'}
                        </button>
                    </div>
                )}

                {/* Hero Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 shrink-0">
                    <DashboardInsights stats={stats} t={t} />
                </div>

                {/* Chart Section */}
                <div className="shrink-0">
                    <UsageChart />
                </div>

                {/* Operations Hub - Expands to fill remaining space */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 flex-1 min-h-[600px]">
                    <div className="lg:col-span-6 flex flex-col h-full min-h-0">
                        <ControlHub className="h-full" />
                    </div>
                    <div className="lg:col-span-6 flex flex-col h-full min-h-0">
                        <RecentActivity />
                    </div>
                </div>
            </div>
        </PageContainer>
    );
}

export default Dashboard;
