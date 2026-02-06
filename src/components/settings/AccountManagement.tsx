
import { useState, useEffect, useMemo } from 'react';
import { useTranslation, Trans } from 'react-i18next';
import {
    Search, RotateCw, Zap,
    ArrowRightLeft, Trash2, CheckCircle2,
    ChevronLeft, ChevronRight, Fingerprint,
    ToggleRight, MoreHorizontal, Lock
} from 'lucide-react';
import DeviceFingerprintDialog from '../accounts/DeviceFingerprintDialog';
import { useAccountStore } from '../../stores/useAccountStore';
import { useConfigStore } from '../../stores/useConfigStore';
import { Button } from '../ui/button';
import { Card } from '../ui/card';

import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Progress } from '../ui/progress';
import { Checkbox } from '../ui/checkbox';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '../ui/table';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator,
} from '../ui/dropdown-menu';
import { cn } from '../../lib/utils';
import { showToast } from '../common/ToastContainer';
import { open } from '@tauri-apps/plugin-dialog';
import { Account } from '../../types/account';

interface AccountManagementProps {
    className?: string;
}

export function AccountManagement({ className }: AccountManagementProps) {
    const { t } = useTranslation();
    const {
        accounts,
        currentAccount,
        loading,
        fetchAccounts,
        refreshAllQuotas,
        warmUpAccounts,
        switchAccount,
        refreshQuota,
        deleteAccount,
        toggleAccountDisabled,
        warmUpAccount, // Added
        importFromCustomDb
    } = useAccountStore();

    const { config } = useConfigStore();

    const [searchTerm, setSearchTerm] = useState('');
    const [selectedAccounts, setSelectedAccounts] = useState<Set<string>>(new Set());
    const [page, setPage] = useState(1);
    const pageSize = config?.accounts_page_size || 10;

    // Fingerprint dialog state
    const [fingerprintAccount, setFingerprintAccount] = useState<Account | null>(null);

    useEffect(() => {
        fetchAccounts();
    }, []);

    const filteredAccounts = useMemo(() =>
        accounts.filter(acc => acc.email.toLowerCase().includes(searchTerm.toLowerCase())),
        [accounts, searchTerm]
    );

    const totalPages = Math.ceil(filteredAccounts.length / pageSize);
    const paginatedAccounts = filteredAccounts.slice((page - 1) * pageSize, page * pageSize);

    const handleSelectAll = (checked: boolean) => {
        if (checked) {
            setSelectedAccounts(new Set(paginatedAccounts.map(a => a.id)));
        } else {
            setSelectedAccounts(new Set());
        }
    };

    const handleSelectOne = (id: string, checked: boolean) => {
        const newSelected = new Set(selectedAccounts);
        if (checked) {
            newSelected.add(id);
        } else {
            newSelected.delete(id);
        }
        setSelectedAccounts(newSelected);
    };

    const handleImport = async () => {
        try {
            const path = await open({
                multiple: false,
                filters: [{ name: 'Database', extensions: ['db', 'sqlite'] }]
            });
            if (path && typeof path === 'string') {
                await importFromCustomDb(path);
                showToast('Import successful', 'success');
            }
        } catch (error) {
            showToast(String(error), 'error');
        }
    };

    const handleDelete = async (id: string) => {
        if (await window.confirm(t('common.confirm_delete'))) {
            try {
                await deleteAccount(id);
                showToast('Account deleted', 'success');
            } catch (error) {
                showToast(String(error), 'error');
            }
        }
    };

    return (
        <Card className={cn("flex flex-col h-full bg-card shadow-sm border-border/40 overflow-hidden", className)}>
            {/* Action Bar */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 px-4 py-3 border-b border-border/40 bg-zinc-50/30 dark:bg-muted/10">
                <div className="flex items-center gap-2 w-full sm:w-auto">
                    <div className="relative flex-1 sm:w-72">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
                        <Input
                            placeholder={t('accounts.search_placeholder')}
                            className="pl-9 h-8 text-xs bg-background border-input/60 focus:bg-background transition-colors hover:border-input rounded-md"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>

                <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-0 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:none]">
                    <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground hover:text-foreground font-medium px-2.5 rounded-md" onClick={() => refreshAllQuotas()} disabled={loading}>
                        {t('common.refresh')}
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground hover:text-purple-600 font-medium px-2.5 rounded-md" onClick={() => warmUpAccounts()}>
                        {t('accounts.warmup_now')}
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 text-xs font-medium text-muted-foreground hover:text-foreground px-2.5 rounded-md" onClick={handleImport}>
                        {t('accounts.import_db')}
                    </Button>
                </div>
            </div>

            {/* Table Container */}
            <div className="flex-1 overflow-y-auto overflow-x-hidden bg-background [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:none]">
                <Table className="w-full table-fixed">
                    <TableHeader className="sticky top-0 bg-zinc-50/80 dark:bg-muted/20 backdrop-blur-sm z-10 border-b border-border/40">
                        <TableRow className="hover:bg-transparent border-none !h-7">
                            <TableHead className="w-[40px] pl-3 !h-7">
                                <Checkbox
                                    checked={paginatedAccounts.length > 0 && selectedAccounts.size === paginatedAccounts.length}
                                    onCheckedChange={(checked) => handleSelectAll(!!checked)}
                                    className="translate-y-[1px] opacity-50 data-[state=checked]:opacity-100 transition-opacity h-3 w-3"
                                />
                            </TableHead>
                            <TableHead className="w-[280px] text-[10px] font-medium text-muted-foreground pl-2 !h-7">{t('accounts.table.email')}</TableHead>
                            <TableHead className="text-[10px] font-medium text-muted-foreground !h-7">{t('accounts.table.quota')}</TableHead>
                            <TableHead className="w-[90px] text-right pr-3 text-[10px] font-medium text-muted-foreground !h-7">{t('accounts.table.actions')}</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {paginatedAccounts.map(account => {
                            const isCurrent = currentAccount?.id === account.id;
                            const tier = (account.quota?.subscription_tier || '').toLowerCase();
                            const isPro = tier.includes('pro') || tier.includes('ultra');

                            const isSelected = selectedAccounts.has(account.id);

                            return (
                                <TableRow key={account.id} className={cn(
                                    "group transition-all duration-300 border-border/40 !h-10",
                                    isCurrent ? "bg-blue-50/40 dark:bg-blue-900/10 hover:bg-blue-50/60 shadow-[inset_2px_0_0_0_#3b82f6]" : "hover:bg-zinc-50/80 dark:hover:bg-muted/10",
                                    isSelected && "bg-muted/40",
                                    account.disabled && "opacity-60 grayscale-[0.8] select-none"
                                )}>
                                    <TableCell className="pl-3 !py-0 w-[40px]">
                                        <Checkbox
                                            checked={isSelected}
                                            onCheckedChange={(checked) => handleSelectOne(account.id, !!checked)}
                                            className="opacity-0 group-hover:opacity-100 data-[state=checked]:opacity-100 transition-opacity h-3 w-3"
                                        />
                                    </TableCell>
                                    <TableCell className="!py-0 pl-2">
                                        <div className="flex items-center gap-2 h-full">
                                            <div className="flex items-center gap-1.5 min-w-0">
                                                <span className={cn(
                                                    "font-medium text-[11px] tracking-tight truncate max-w-[160px]",
                                                    isCurrent ? "text-blue-600 dark:text-blue-400" : "text-foreground"
                                                )}>{account.email}</span>
                                                {isCurrent && (
                                                    <CheckCircle2 className="h-2.5 w-2.5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                                                )}
                                            </div>

                                            <div className="flex items-center gap-1.5 flex-shrink-0">
                                                <Badge
                                                    variant="outline"
                                                    className={cn(
                                                        "h-3.5 px-1 text-[9px] font-normal border-border/50",
                                                        isPro && "bg-indigo-50/50 text-indigo-600 border-indigo-200 dark:border-indigo-800/30 dark:text-indigo-400"
                                                    )}
                                                >
                                                    {isPro ? "Pro" : "Free"}
                                                </Badge>
                                                {account.quota?.tier_reset_date && (
                                                    <span className="text-[9px] text-muted-foreground/60 flex items-center">
                                                        {new Date(account.quota.tier_reset_date).toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' })}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell className="!py-0">
                                        <div className="grid grid-cols-2 xl:grid-cols-4 gap-x-3 gap-y-0.5 !py-0.5">
                                            {account.quota?.models?.slice(0, 4).map(model => (
                                                <div key={model.name} className="flex items-center gap-1.5">
                                                    <span className="text-[9px] font-medium text-muted-foreground/80 truncate w-12 flex-shrink-0">
                                                        {getModelDisplayName(model.name)}
                                                    </span>
                                                    <Progress
                                                        value={model.percentage}
                                                        className="h-1 flex-1 bg-muted/40 min-w-[40px]"
                                                        indicatorClassName={cn(
                                                            "transition-all duration-500",
                                                            model.percentage > 80 ? "bg-green-500" :
                                                                model.percentage > 40 ? "bg-orange-500" : "bg-red-500"
                                                        )}
                                                    />
                                                    <span className={cn(
                                                        "text-[9px] tabular-nums w-6 text-right",
                                                        getQuotaColor(model.percentage)
                                                    )}>
                                                        {model.percentage}%
                                                    </span>
                                                </div>
                                            ))}
                                            {(!account.quota?.models || account.quota.models.length === 0) && (
                                                <div className="col-span-full h-4 flex items-center gap-2 px-0 text-muted-foreground/40">
                                                    <span className="text-[9px]">
                                                        {t('common.no_data', 'No Data')}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell className="pr-4 !py-0 text-right w-[60px]">
                                        <div className="flex items-center justify-end h-full">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 p-0 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                                        onClick={(e) => e.stopPropagation()}
                                                    >
                                                        <MoreHorizontal className="h-4 w-4 text-slate-500" />
                                                        <span className="sr-only">Open menu</span>
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end" className="w-48" onClick={(e) => e.stopPropagation()}>
                                                    {/* 基本操作 */}
                                                    <DropdownMenuItem onClick={() => switchAccount(account.id)} className="gap-1.5 py-1.5 cursor-pointer">
                                                        <ArrowRightLeft className="w-3.5 h-3.5 text-muted-foreground/70" />
                                                        <span className="font-medium text-[11px] text-slate-700 dark:text-slate-300 whitespace-nowrap">{t('accounts.switch_to')}</span>
                                                    </DropdownMenuItem>

                                                    <DropdownMenuItem onClick={() => warmUpAccount(account.id)} className="gap-1.5 py-1.5 cursor-pointer">
                                                        <Zap className="w-3.5 h-3.5 text-muted-foreground/70" />
                                                        <span className="font-medium text-[11px] text-slate-700 dark:text-slate-300 whitespace-nowrap">{t('accounts.warmup_now')}</span>
                                                    </DropdownMenuItem>

                                                    <DropdownMenuItem onClick={() => refreshQuota(account.id)} className="gap-1.5 py-1.5 cursor-pointer">
                                                        <RotateCw className={cn("w-3.5 h-3.5 text-muted-foreground/70", loading && "animate-spin")} />
                                                        <span className="font-medium text-[11px] text-slate-700 dark:text-slate-300 whitespace-nowrap">{t('common.refresh')}</span>
                                                    </DropdownMenuItem>

                                                    <DropdownMenuSeparator />

                                                    {/* 设置操作 */}
                                                    <DropdownMenuItem onClick={() => setFingerprintAccount(account)} className="gap-1.5 py-1.5 cursor-pointer">
                                                        <Fingerprint className="w-3.5 h-3.5 text-muted-foreground/70" />
                                                        <span className="font-medium text-[11px] text-slate-700 dark:text-slate-300 whitespace-nowrap">{t('accounts.device_fingerprint_dialog.title') || "Device Fingerprint"}</span>
                                                    </DropdownMenuItem>

                                                    {/* 禁用切换 */}
                                                    <DropdownMenuItem
                                                        onClick={() => toggleAccountDisabled(account.id, !account.disabled)}
                                                        className={cn(
                                                            "gap-1.5 py-1.5 cursor-pointer transition-colors",
                                                            account.disabled ? "focus:bg-emerald-50 dark:focus:bg-emerald-900/20" : "focus:bg-rose-50 dark:focus:bg-rose-900/20"
                                                        )}
                                                    >
                                                        {account.disabled ? (
                                                            <>
                                                                <ToggleRight className="w-3.5 h-3.5 text-muted-foreground/70" />
                                                                <span className="font-medium text-[11px] text-slate-700 dark:text-slate-300 whitespace-nowrap">{t('accounts.enable_account')}</span>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <Lock className="w-3.5 h-3.5 text-muted-foreground/70" />
                                                                <span className="font-medium text-[11px] text-slate-700 dark:text-slate-300 whitespace-nowrap">{t('accounts.disable_account_manual')}</span>
                                                            </>
                                                        )}
                                                    </DropdownMenuItem>

                                                    <DropdownMenuSeparator />

                                                    {/* 危险操作 */}
                                                    <DropdownMenuItem
                                                        onClick={() => handleDelete(account.id)}
                                                        className="gap-1.5 py-1.5 text-destructive/80 focus:text-destructive focus:bg-destructive/5 cursor-pointer"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                        <span className="font-medium text-[11px] whitespace-nowrap">{t('common.delete')}</span>
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            );
                        })}

                        {paginatedAccounts.length === 0 && (
                            <TableRow className="hover:bg-transparent !h-8">
                                <TableCell colSpan={4} className="h-[300px]">
                                    <div className="flex flex-col items-center justify-center gap-2 text-center">
                                        <div className="p-3 bg-muted/30 rounded-full mb-1">
                                            <Search className="w-5 h-5 text-muted-foreground/40" />
                                        </div>
                                        <div className="space-y-0.5">
                                            <p className="text-xs font-medium text-foreground">{t('accounts.not_found', 'No accounts found')}</p>
                                        </div>
                                    </div>
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* Pagination & Status Footer */}
            <div className="flex items-center justify-between px-3 py-1.5 border-t border-border/40 text-[10px] shrink-0 bg-zinc-50/30 dark:bg-muted/10">
                <div className="flex items-center gap-4 text-muted-foreground">
                    <Trans
                        i18nKey="accounts.total_summary"
                        count={filteredAccounts.length}
                        components={{ 1: <span className="font-medium text-foreground" /> }}
                    />
                    {selectedAccounts.size > 0 && (
                        <span className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400 font-medium">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            {t('accounts.selected_summary', { count: selectedAccounts.size })}
                        </span>
                    )}
                </div>

                <div className="flex items-center gap-3">
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        disabled={page === 1}
                        onClick={() => setPage(p => p - 1)}
                    >
                        <ChevronLeft className="h-3.5 w-3.5" />
                    </Button>
                    <span className="min-w-[40px] text-center font-medium">
                        {page} / {totalPages || 1}
                    </span>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        disabled={page >= totalPages}
                        onClick={() => setPage(p => p + 1)}
                    >
                        <ChevronRight className="h-3.5 w-3.5" />
                    </Button>
                </div>
            </div>

            {/* Floating Selection Bar */}
            {
                selectedAccounts.size > 0 && (
                    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in zoom-in slide-in-from-bottom-4 duration-300">
                        <div className="flex items-center gap-4 px-5 py-2.5 bg-gray-900/95 dark:bg-gray-100/95 backdrop-blur-md rounded-full shadow-2xl border border-white/10 ring-1 ring-black/5">
                            <div className="flex items-center gap-2 text-gray-100 dark:text-gray-900 border-r pr-3 border-gray-700/50 dark:border-gray-300/50">
                                <span className="text-[11px] font-bold tracking-wider">{t('accounts.selection_ready', { count: selectedAccounts.size })}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <Button size="sm" variant="ghost" className="h-7 px-2.5 text-xs font-bold text-blue-400 dark:text-blue-600 hover:bg-white/10 rounded-md" onClick={() => warmUpAccounts()}>
                                    {t('accounts.batch_warmup')}
                                </Button>
                                <Button size="sm" variant="ghost" className="h-7 px-2.5 text-xs font-bold text-red-400 dark:text-red-600 hover:bg-white/10 rounded-md" onClick={() => {
                                    if (window.confirm(t('accounts.dialog.confirm_batch_delete', { count: selectedAccounts.size }))) {
                                        selectedAccounts.forEach(id => deleteAccount(id));
                                        setSelectedAccounts(new Set());
                                    }
                                }}>
                                    {t('accounts.batch_delete')}
                                </Button>
                                <Button size="sm" className="h-7 rounded-full bg-white text-black hover:bg-white/90 dark:bg-black dark:text-white dark:hover:bg-black/90 font-bold text-xs px-4 ml-1" onClick={() => setSelectedAccounts(new Set())}>
                                    {t('common.cancel')}
                                </Button>
                            </div>
                        </div>
                    </div>
                )
            }
            {fingerprintAccount && (
                <DeviceFingerprintDialog
                    account={fingerprintAccount}
                    onClose={() => setFingerprintAccount(null)}
                />
            )}
        </Card >
    );
}

// Helpers
function getModelDisplayName(fullName: string): string {
    const nameMap: Record<string, string> = {
        'gemini-1.5-pro': 'G1.5 Pro',
        'gemini-1.5-flash': 'G1.5 Flash',
        'gemini-pro-vision': 'G Pro Vision',
        'claude-3-opus': 'C3 Opus',
        'claude-3-sonnet': 'C3 Sonnet',
        'claude-3-haiku': 'C3 Haiku',
    };

    for (const [key, val] of Object.entries(nameMap)) {
        if (fullName.includes(key)) return val;
    }
    return fullName.split('/').pop() || fullName;
}

function getQuotaColor(percentage: number): string {
    if (percentage > 80) return 'text-green-500';
    if (percentage > 40) return 'text-orange-500';
    return 'text-red-500';
}
