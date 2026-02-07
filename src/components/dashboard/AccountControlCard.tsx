import { useMemo, useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Zap,
    RefreshCw,
    Globe,
    ChevronsUp,
    AlertCircle,
    MoreHorizontal
} from 'lucide-react';
import { useAccountStore } from '../../stores/useAccountStore';
import { useActivityStore } from '../../stores/useActivityStore';
import { PremiumProgressRow } from "@/components/ui/premium-progress-row";
import { cn } from "@/lib/utils";
import { Card } from '../ui/card';
import { Button } from '../ui/button';


interface AccountControlCardProps {
    className?: string;
}

export function AccountControlCard({ className }: AccountControlCardProps) {
    const { t } = useTranslation();
    const [isExpanded, setIsExpanded] = useState(false);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);
    const { accounts, currentAccount: storeCurrentAccount, switchAccount, refreshAllQuotas, toggleProxyStatus, resetForbiddenAccounts, fetchCurrentAccount } = useAccountStore();
    const { fetchRecentActivity, fetchUsageHistory } = useActivityStore();

    // Close menu when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsMenuOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

    // [FIX] 直接使用 storeCurrentAccount,不要从 accounts 数组中查找
    // 原因:accounts 数组可能还没有更新,导致显示旧账号
    const currentAccount = storeCurrentAccount;

    // --- Logic from BestAccounts ---

    const recommendations = useMemo(() => {
        // 合并所有非当前账号
        const otherAccounts = accounts.filter(a => !currentAccount || a.id !== currentAccount.id);

        // 为每个账号计算一个综合分用于排序
        return otherAccounts.map(a => {
            const models = a.quota?.models || [];
            const proQuota = models.find(m => m.name.toLowerCase() === 'gemini-3-pro-high')?.percentage || 0;
            const flashQuota = models.find(m => m.name.toLowerCase() === 'gemini-3-flash')?.percentage || 0;
            const claudeQuota = models.find(m => m.name.toLowerCase().includes('claude'))?.percentage || 0;

            // 综合分逻辑：取 Gemini 和 Claude 的最大值作为展示值
            const quotaVal = Math.max(proQuota, flashQuota, claudeQuota);

            return {
                ...a,
                quotaVal,
                // 根据最高分的来源决定图标
                type: claudeQuota > Math.max(proQuota, flashQuota) ? 'claude' : 'gemini'
            };
        }).sort((a, b) => b.quotaVal - a.quotaVal);
    }, [accounts, currentAccount]);



    // Actions
    const handleSyncAccount = async () => {
        setIsMenuOpen(false);
        console.log('🔄 Syncing account state...');
        // 强制重新获取当前账号（绕过缓存）
        await fetchCurrentAccount();
        // 刷新配额数据
        await refreshAllQuotas();
        // 刷新日志
        fetchRecentActivity();
        fetchUsageHistory();
        console.log('✅ Account state synced');
    };

    const handleRefresh = async () => {
        setIsMenuOpen(false);
        await refreshAllQuotas();
    };

    const handleProxyToggle = async () => {
        setIsMenuOpen(false);
        if (currentAccount) {
            await toggleProxyStatus(currentAccount.id, !!currentAccount.proxy_disabled, "Manual toggle");
        }
    };

    const handleResetForbidden = async () => {
        setIsMenuOpen(false);
        try {
            const stats = await resetForbiddenAccounts();
            if (stats.count > 0) {
                // Optionally show a toast or success message
            }
        } catch (error) {
            console.error('Failed to reset forbidden accounts:', error);
        }
    };

    const hasForbidden = useMemo(() => accounts.some(a => a.quota?.is_forbidden), [accounts]);

    // Helper removed, using PremiumProgressRow directly


    return (
        <Card className={cn("hidden md:flex flex-col h-full overflow-hidden bg-white/50 dark:bg-zinc-900/50 backdrop-blur-sm border-border/50", className)}>
            <div className="flex-1 flex flex-col gap-3 min-h-0 overflow-y-auto scrollbar-hide pb-4">

                {/* Section 1: Smart Network */}
                <div className="flex-none flex flex-col gap-0.5">
                    <div className="flex items-center h-[32px] px-4 shrink-0">
                        <h2 className="text-[13px] font-medium tracking-tight text-foreground/90">
                            {t('dashboard.smart_network')}
                        </h2>
                    </div>

                    <div className="flex-1 flex flex-col gap-2 px-4">
                        {/* 1.1 Active Account */}
                        <Card className="shrink-0 rounded-xl border-border/40 bg-transparent p-3 flex flex-col gap-3 shadow-none">
                            <div className="flex items-center justify-between px-0.5 relative">
                                <h3 className="text-[12px] font-medium text-foreground/90 tracking-tight">{t('dashboard.active_account_card')}</h3>

                                <div className="flex items-center gap-2">
                                    {currentAccount && (
                                        <div className={cn(
                                            "flex items-center gap-1.5 px-2 py-0.5 rounded-full border",
                                            currentAccount.proxy_disabled
                                                ? "bg-red-500/5 border-red-500/10 text-red-600 dark:text-red-400"
                                                : "bg-emerald-500/5 border-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                        )}>
                                            <div className={cn(
                                                "w-1.5 h-1.5 rounded-full",
                                                currentAccount.proxy_disabled ? "bg-red-500" : "bg-emerald-500 animate-pulse"
                                            )} />
                                            <span className="text-[10px] font-medium">
                                                {currentAccount.proxy_disabled ? "Paused" : "Active"}
                                            </span>
                                        </div>
                                    )}

                                    {/* Dropdown Menu Trigger */}
                                    <div className="relative" ref={menuRef}>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-6 w-6 p-0 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md"
                                            onClick={() => setIsMenuOpen(!isMenuOpen)}
                                        >
                                            <MoreHorizontal className="w-4 h-4 text-muted-foreground" />
                                        </Button>

                                        {isMenuOpen && (
                                            <div className="absolute right-0 top-7 w-32 bg-white dark:bg-zinc-900 border border-border/50 rounded-lg shadow-lg py-1 z-50 flex flex-col animate-in fade-in zoom-in-95 duration-100">
                                                <button onClick={handleSyncAccount} className="w-full text-left px-3 py-1.5 text-[11px] hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors flex items-center gap-2 text-foreground/80">
                                                    <Zap className="w-3 h-3 text-muted-foreground" />
                                                    {t('dashboard.switch')}
                                                </button>
                                                <button onClick={handleRefresh} className="w-full text-left px-3 py-1.5 text-[11px] hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors flex items-center gap-2 text-foreground/80">
                                                    <RefreshCw className="w-3 h-3 text-muted-foreground" />
                                                    {t('dashboard.refresh')}
                                                </button>
                                                <button onClick={handleProxyToggle} className="w-full text-left px-3 py-1.5 text-[11px] hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors flex items-center gap-2 text-foreground/80">
                                                    <Globe className="w-3 h-3 text-muted-foreground" />
                                                    {currentAccount?.proxy_disabled ? "Enable Proxy" : "Pause Proxy"}
                                                </button>
                                                {hasForbidden && (
                                                    <button onClick={handleResetForbidden} className="w-full text-left px-3 py-1.5 text-[11px] hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors flex items-center gap-2 text-red-600 dark:text-red-400">
                                                        <AlertCircle className="w-3 h-3 text-red-500" />
                                                        Reset 403
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="rounded-lg border border-border/40 bg-white dark:bg-zinc-900 shadow-sm flex flex-col overflow-hidden">
                                {currentAccount ? (
                                    <div className="p-2 space-y-2">
                                        <div className="flex items-center gap-2 px-1 pb-1 border-b border-border/5 justify-between">
                                            <span className="text-[13px] font-medium tracking-tight text-foreground truncate block" title={currentAccount.email}>
                                                {currentAccount.email}
                                            </span>
                                            {currentAccount.quota?.is_forbidden && (
                                                <AlertCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />
                                            )}
                                        </div>

                                        <div className={cn(
                                            "space-y-1 relative transition-all duration-300 ease-in-out",
                                            !isExpanded && (currentAccount.quota?.models?.length || 0) > 5 ? "max-h-[160px] overflow-hidden" : "max-h-none"
                                        )}>
                                            {currentAccount.quota?.models && currentAccount.quota.models.length > 0 ? (
                                                currentAccount.quota.models.map((model) => {
                                                    const displayName = model.name
                                                        .replace(/^gemini-/, '')
                                                        .replace(/^claude-/, '')
                                                        .split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');

                                                    return (
                                                        <PremiumProgressRow
                                                            key={model.name}
                                                            value={model.percentage}
                                                            label={displayName}
                                                        />
                                                    );
                                                })
                                            ) : (
                                                <div className="py-2 text-center">
                                                    <span className="text-[11px] text-muted-foreground/60 italic">No model data</span>
                                                </div>
                                            )}

                                            {!isExpanded && (currentAccount.quota?.models?.length || 0) > 5 && (
                                                <div
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setIsExpanded(true);
                                                    }}
                                                    className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-white dark:from-zinc-900 via-white/80 dark:via-zinc-900/80 to-transparent flex items-end justify-center pb-1 cursor-pointer group/more transition-all hover:h-12 z-10"
                                                />
                                            )}

                                            {isExpanded && (currentAccount.quota?.models?.length || 0) > 5 && (
                                                <div
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setIsExpanded(false);
                                                    }}
                                                    className="flex items-center justify-center py-1 mt-1 cursor-pointer group/collapse hover:bg-zinc-500/5 rounded-sm transition-all border-t border-border/5"
                                                >
                                                    <ChevronsUp className="w-3.5 h-3.5 text-foreground/30 group-hover/collapse:text-foreground/60 transition-colors" />
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex-1 flex items-center justify-center p-4 bg-zinc-50/20 dark:bg-white/[0.01]">
                                        <p className="text-sm text-muted-foreground/60 font-normal">No active account</p>
                                    </div>
                                )}
                            </div>

                            {/* Previous button grid removed, functions moved to dropdown */}
                        </Card>

                        {/* 1.2 Candidates */}
                        <Card className="shrink-0 rounded-xl border-border/40 bg-transparent p-3 flex flex-col gap-3 shadow-none">
                            <h3 className="text-[12px] font-medium text-foreground/90 tracking-tight">{t('dashboard.candidates')}</h3>

                            <div className="rounded-lg border border-border/40 bg-white dark:bg-zinc-900 shadow-sm flex flex-col overflow-hidden">
                                <div className="p-2 flex flex-col gap-1">
                                    {recommendations.length > 0 ? (
                                        recommendations.map((item: any) => (
                                            <div key={`${item.id}-${item.type}`}
                                                onClick={async () => {
                                                    console.log('🔵 [AccountControlCard] Candidate clicked:', item.email, item.id);
                                                    console.log('🔵 [AccountControlCard] Current account before switch:', storeCurrentAccount?.email);

                                                    try {
                                                        console.log('🔵 [AccountControlCard] Calling switchAccount...');
                                                        await switchAccount(item.id);
                                                        console.log('✅ [AccountControlCard] switchAccount completed');

                                                        console.log('🔵 [AccountControlCard] Fetching recent activity...');
                                                        fetchRecentActivity();
                                                        console.log('🔵 [AccountControlCard] Fetching usage history...');
                                                        fetchUsageHistory();
                                                        console.log('✅ [AccountControlCard] All post-switch actions completed');
                                                    } catch (error) {
                                                        console.error('❌ [AccountControlCard] Switch failed:', error);
                                                    }
                                                }}
                                                className="cursor-pointer"
                                            >
                                                <PremiumProgressRow
                                                    label={item.email}
                                                    value={item.quotaVal}
                                                />
                                            </div>
                                        ))
                                    ) : (
                                        <div className="flex-1 flex items-center justify-center p-4 bg-zinc-50/20 dark:bg-white/[0.01]">
                                            <span className="text-sm text-muted-foreground/60 font-normal">{t('dashboard.no_candidates')}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </Card>
                    </div>
                </div>

                {/* Section 2: System Nodes - Single Card Mode */}
                <div className="flex-none flex flex-col gap-1 pb-4">
                    <div className="flex items-center h-[32px] px-4 shrink-0">
                        <h2 className="text-[13px] font-medium tracking-tight text-foreground/90">
                            {t('dashboard.system_nodes')}
                        </h2>
                    </div>

                    <div className="flex-1 flex flex-col gap-1.5 px-4 pb-2">
                        <div className="rounded-lg border border-border/40 bg-white dark:bg-zinc-900 shadow-sm flex flex-col overflow-hidden min-h-[80px]">
                            <div className="flex-1 overflow-y-auto min-h-0 flex flex-col">
                                <div className="flex items-center justify-between px-4 py-3 hover:bg-zinc-50 dark:hover:bg-white/5 transition-all shrink-0">
                                    <div className="flex flex-col gap-1.5">
                                        <span className="text-[13px] font-medium text-foreground/85">{t('dashboard.local_gateway')}</span>
                                        <span className="text-[11px] text-muted-foreground/60 tabular-nums">127.0.0.1:8045</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-[11px] font-medium text-emerald-500/80">{t('dashboard.online')}</span>
                                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                    </div>
                                </div>
                                <div className="flex-1 flex items-center justify-center p-4 bg-zinc-50/20 dark:bg-white/[0.01] border-t border-border/10">
                                    <span className="text-sm text-muted-foreground/60 italic">{t('dashboard.no_remote_nodes')}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </Card>
    );
}

export default AccountControlCard;
