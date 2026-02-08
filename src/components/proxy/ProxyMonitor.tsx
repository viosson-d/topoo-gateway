import React, { useEffect, useState, useRef, useMemo } from 'react';
import { cn } from '../../lib/utils';
import ModalDialog from '../common/ModalDialog';
import { useTranslation } from 'react-i18next';
import { request as invoke } from '../../utils/request';
import { Trash2, Search, X, Copy, CheckCircle, ChevronLeft, ChevronRight, RefreshCw, User, Loader2 } from 'lucide-react';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "../../components/ui/table";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "../../components/ui/select";

import { AppConfig } from '../../types/config';
import { formatCompactNumber } from '../../utils/format';
import { useAccountStore } from '../../stores/useAccountStore';


interface ProxyRequestLog {
    id: string;
    timestamp: number;
    method: string;
    url: string;
    status: number;
    duration: number;
    model?: string;
    mapped_model?: string;
    error?: string;
    request_body?: string;
    response_body?: string;
    input_tokens?: number;
    output_tokens?: number;
    account_email?: string;
    protocol?: string;  // "openai" | "anthropic" | "gemini"
    client?: string;
    account_name?: string;
}

interface ProxyStats {
    total_requests: number;
    success_count: number;
    error_count: number;
}

interface ProxyMonitorProps {
    className?: string;
    isLoggingEnabled?: boolean;
    onToggleLogging?: () => void;
}

// Log Table Component
interface LogTableProps {
    logs: ProxyRequestLog[];
    loading: boolean;
    onLogClick: (log: ProxyRequestLog) => void;
    t: any;
}

const LogTable: React.FC<LogTableProps> = ({
    logs,
    loading,
    onLogClick,
    t
}) => {
    return (
        <div className="flex-1 overflow-auto bg-background/50">
            <Table>
                <TableHeader className="bg-muted/50 sticky top-0 z-10 backdrop-blur-sm border-t-0">
                    <TableRow className="hover:bg-transparent border-b-0 !h-7">
                        <TableHead className="w-[80px] text-[10px] font-medium !h-7">{t('monitor.table.status')}</TableHead>
                        <TableHead className="w-[80px] text-[10px] font-medium !h-7">{t('monitor.table.method')}</TableHead>
                        <TableHead className="w-[200px] text-[10px] font-medium !h-7">{t('monitor.table.model')}</TableHead>
                        <TableHead className="w-[100px] text-[10px] font-medium !h-7">{t('monitor.table.protocol')}</TableHead>
                        <TableHead className="w-[160px] text-[10px] font-medium !h-7">{t('monitor.table.account')}</TableHead>
                        <TableHead className="w-[200px] text-[10px] font-medium !h-7">{t('monitor.table.path')}</TableHead>
                        <TableHead className="text-right w-[100px] text-[10px] font-medium !h-7">{t('monitor.table.usage')}</TableHead>
                        <TableHead className="text-right w-[80px] text-[10px] font-medium !h-7">{t('monitor.table.duration')}</TableHead>
                        <TableHead className="text-right w-[100px] text-[10px] font-medium !h-7">{t('monitor.table.time')}</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {loading && logs.length === 0 ? (
                        <TableRow className="!h-8">
                            <TableCell colSpan={9} className="h-24 text-center text-muted-foreground text-xs">
                                <div className="flex items-center justify-center gap-2">
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    <span>{t('common.loading')}</span>
                                </div>
                            </TableCell>
                        </TableRow>
                    ) : logs.length === 0 ? (
                        <TableRow className="!h-8">
                            <TableCell colSpan={9} className="h-24 text-center text-muted-foreground text-xs">
                                {t('monitor.table.empty') || '暂无请求记录'}
                            </TableCell>
                        </TableRow>
                    ) : (
                        logs.map((log) => (
                            <TableRow
                                key={log.id}
                                className="cursor-pointer hover:bg-muted/40 transition-colors border-b border-border/20 dark:border-zinc-800/30 !h-8"
                                onClick={() => onLogClick(log)}
                            >
                                <TableCell className="!py-0">
                                    <Badge variant={log.status >= 200 && log.status < 400 ? "outline" : "destructive"} className={cn("font-normal text-[10px] px-1.5 h-4", log.status >= 200 && log.status < 400 && "text-green-600 border-green-200 bg-green-50 dark:bg-green-900/10 dark:text-green-400 dark:border-green-900/30")}>
                                        {log.status}
                                    </Badge>
                                </TableCell>
                                <TableCell className="!py-0 text-[10px] font-medium text-foreground/80">{log.method}</TableCell>
                                <TableCell className="!py-0">
                                    <div className="flex items-center gap-1.5 max-w-[180px]">
                                        <span className="truncate text-[10px] text-primary font-medium" title={log.mapped_model || log.model}>
                                            {log.mapped_model || log.model || '-'}
                                        </span>
                                        {log.mapped_model && log.model !== log.mapped_model && (
                                            <span className="text-[9px] text-muted-foreground/50 shrink-0">
                                                (from {log.model})
                                            </span>
                                        )}
                                    </div>
                                </TableCell>
                                <TableCell className="!py-0">
                                    {log.protocol && (
                                        <Badge variant="secondary" className="font-normal text-[9px] px-1.5 h-4 bg-muted/50 text-muted-foreground hover:bg-muted">
                                            {log.protocol === 'openai' ? 'OpenAI' :
                                                log.protocol === 'anthropic' ? 'Claude' :
                                                    log.protocol === 'gemini' ? 'Gemini' : log.protocol}
                                        </Badge>
                                    )}
                                </TableCell>
                                <TableCell className="!py-0">
                                    <div className="flex flex-col justify-center h-full">
                                        <span className="text-[10px] font-medium text-foreground/90 truncate block max-w-[140px]" title={log.account_email || ''}>
                                            {log.account_name || log.account_email || '-'}
                                        </span>
                                        {/* If we have a name, show email in smaller text or just rely on tooltip. 
                                            Given row height !h-8, distinct lines might be tight. 
                                            Let's stick to Name-first approach. */}
                                    </div>
                                </TableCell>
                                <TableCell className="!py-0">
                                    <span className="text-[10px] text-muted-foreground/70 truncate block max-w-[180px]" title={log.url}>{log.url}</span>
                                </TableCell>
                                <TableCell className="!py-0 text-right">
                                    <div className="space-y-0.5">
                                        {log.input_tokens != null && <div className="text-[9px] text-muted-foreground">I: {formatCompactNumber(log.input_tokens)}</div>}
                                        {log.output_tokens != null && <div className="text-[9px] text-muted-foreground">O: {formatCompactNumber(log.output_tokens)}</div>}
                                    </div>
                                </TableCell>
                                <TableCell className="!py-0 text-right text-[10px] text-muted-foreground font-mono">{log.duration}ms</TableCell>
                                <TableCell className="!py-0 text-right text-[10px] text-muted-foreground/60">{new Date(log.timestamp).toLocaleTimeString()}</TableCell>
                            </TableRow>
                        ))
                    )}
                </TableBody>
            </Table>
        </div>
    );
};


export const ProxyMonitor: React.FC<ProxyMonitorProps> = ({
    className,
    isLoggingEnabled: externalIsLoggingEnabled,
    onToggleLogging: _onToggleLogging
}) => {
    const { t } = useTranslation();
    const [logs, setLogs] = useState<ProxyRequestLog[]>([]);
    const [stats, setStats] = useState<ProxyStats>({ total_requests: 0, success_count: 0, error_count: 0 });
    const [filter, setFilter] = useState('');
    const [accountFilter, setAccountFilter] = useState('');
    const [selectedLog, setSelectedLog] = useState<ProxyRequestLog | null>(null);
    const [_localIsLoggingEnabled, setLocalIsLoggingEnabled] = useState(false);
    const [isClearConfirmOpen, setIsClearConfirmOpen] = useState(false);
    const [copiedRequestId, setCopiedRequestId] = useState<string | null>(null);

    // Use external logging state if provided, otherwise use local state
    // const isLoggingEnabled = externalIsLoggingEnabled ?? localIsLoggingEnabled;
    const setIsLoggingEnabled = externalIsLoggingEnabled !== undefined ? () => { } : setLocalIsLoggingEnabled;

    const { accounts, fetchAccounts } = useAccountStore();

    // Pagination state
    const PAGE_SIZE_OPTIONS = [50, 100, 200, 500];
    const [pageSize, setPageSize] = useState(100);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalCount, setTotalCount] = useState(0);
    const [loading, setLoading] = useState(false);
    const [loadingDetail, setLoadingDetail] = useState(false);

    const uniqueAccounts = useMemo(() => {
        const emailSet = new Set<string>();
        logs.forEach(log => {
            if (log.account_email) {
                emailSet.add(log.account_email);
            }
        });
        accounts.forEach(acc => {
            emailSet.add(acc.email);
        });
        return Array.from(emailSet).sort();
    }, [logs, accounts]);

    const loadData = async (page = 1, searchFilter = filter, accountEmailFilter = accountFilter) => {
        if (loading) return;
        setLoading(true);

        try {
            // Add timeout control (10 seconds)
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Request timeout')), 10000)
            );

            const config = await Promise.race([
                invoke<AppConfig>('load_config'),
                timeoutPromise
            ]) as AppConfig;

            if (config && config.proxy) {
                setIsLoggingEnabled(config.proxy.enable_logging);
                await invoke('set_proxy_monitor_enabled', { enabled: config.proxy.enable_logging });
            }

            const errorsOnly = searchFilter === '__ERROR__';
            const baseFilter = errorsOnly ? '' : searchFilter;
            const actualFilter = accountEmailFilter
                ? (baseFilter ? `${baseFilter} ${accountEmailFilter}` : accountEmailFilter)
                : baseFilter;

            // Get count with filter
            const count = await Promise.race([
                invoke<number>('get_proxy_logs_count_filtered', {
                    filter: actualFilter,
                    errorsOnly: errorsOnly
                }),
                timeoutPromise
            ]) as number;
            setTotalCount(count);

            // Use filtered paginated query
            const offset = (page - 1) * pageSize;
            const history = await Promise.race([
                invoke<ProxyRequestLog[]>('get_proxy_logs_filtered', {
                    filter: actualFilter,
                    errorsOnly: errorsOnly,
                    limit: pageSize,
                    offset: offset
                }),
                timeoutPromise
            ]) as ProxyRequestLog[];

            if (Array.isArray(history)) {
                setLogs(history);
                // Clear pending logs to avoid duplicates (database data is authoritative)
                pendingLogsRef.current = [];
            }

            const currentStats = await Promise.race([
                invoke<ProxyStats>('get_proxy_stats'),
                timeoutPromise
            ]) as ProxyStats;

            if (currentStats) setStats(currentStats);
        } catch (e: any) {
            console.error("Failed to load proxy data", e);
            if (e.message === 'Request timeout') {
                // Show timeout error to user
                console.error('Loading monitor data timeout, please try again later');
            }
        } finally {
            setLoading(false);
        }
    };

    const totalPages = Math.ceil(totalCount / pageSize);

    const goToPage = (page: number) => {
        if (page >= 1 && page <= totalPages && page !== currentPage) {
            setCurrentPage(page);
            loadData(page, filter, accountFilter);
        }
    };

    const pendingLogsRef = useRef<ProxyRequestLog[]>([]);
    const isMountedRef = useRef(true);

    useEffect(() => {
        isMountedRef.current = true;
        loadData();
        fetchAccounts();

        // [OPTIMIZE] Switch from event-based to polling-based updates to prevent IPC flooding
        // Instead of listening to every single request event (which can freeze the UI under load),
        // we poll the backend every 1.5 seconds for the latest data.
        const pollInterval = setInterval(() => {
            if (isMountedRef.current) {
                // Use a silent loadData to avoid flickering loading indicators
                // We pass current filters to maintain view state
                // Note: We don't use 'loading' state here to let user interact while polling
                loadData(currentPage, filter, accountFilter);
            }
        }, 1500);

        return () => {
            isMountedRef.current = false;
            clearInterval(pollInterval);
        };
    }, [currentPage, filter, accountFilter]); // Re-setup polling if filters change (to ensure correct params)

    useEffect(() => {
        setCopiedRequestId(null);
    }, [selectedLog?.id]);

    // Reload when pageSize changes
    useEffect(() => {
        setCurrentPage(1);
        loadData(1, filter, accountFilter);
    }, [pageSize]);

    // Reload when filter changes (search based on all logs)
    useEffect(() => {
        setCurrentPage(1);
        loadData(1, filter, accountFilter);
    }, [filter, accountFilter]);

    // Logs are already filtered and sorted by backend
    // Apply account filter on frontend
    const filteredLogs = useMemo(() => {
        if (!accountFilter) return logs;
        return logs.filter(log => log.account_email === accountFilter);
    }, [logs, accountFilter]);

    const quickFilters = [
        { label: t('monitor.filters.all'), value: '' },
        { label: t('monitor.filters.error'), value: '__ERROR__' },
        { label: t('monitor.filters.chat'), value: 'completions' },
        { label: t('monitor.filters.gemini'), value: 'gemini' },
        { label: t('monitor.filters.claude'), value: 'claude' },
        { label: t('monitor.filters.images'), value: 'images' }
    ];

    const clearLogs = () => {
        setIsClearConfirmOpen(true);
    };

    const executeClearLogs = async () => {
        setIsClearConfirmOpen(false);
        try {
            await invoke('clear_proxy_logs');
            setLogs([]);
            setStats({ total_requests: 0, success_count: 0, error_count: 0 });
            setTotalCount(0);
        } catch (e) {
            console.error("Failed to clear logs", e);
        }
    };

    const formatBody = (body?: string) => {
        if (!body) return <span className="text-muted-foreground/60 italic text-xs">{t('monitor.details.payload_empty')}</span>;
        try {
            const obj = JSON.parse(body);
            return <pre className="text-[10px] font-mono whitespace-pre-wrap text-foreground">{JSON.stringify(obj, null, 2)}</pre>;
        } catch (e) {
            return <pre className="text-[10px] font-mono whitespace-pre-wrap text-foreground">{body}</pre>;
        }
    };

    const getCopyPayload = (body: string) => {
        try {
            const obj = JSON.parse(body);
            return JSON.stringify(obj, null, 2);
        } catch (e) {
            return body;
        }
    };

    const handleCopyRequest = async () => {
        if (!selectedLog?.request_body) return;
        try {
            await navigator.clipboard.writeText(getCopyPayload(selectedLog.request_body));
            setCopiedRequestId(selectedLog.id);
            setTimeout(() => {
                setCopiedRequestId((current) => (current === selectedLog.id ? null : current));
            }, 2000);
        } catch (e) {
            console.error('Failed to copy request payload', e);
        }
    };

    return (
        <div className={cn(
            "flex flex-col h-full bg-background border rounded-xl overflow-hidden shadow-sm",
            className
        )}>
            {/* Toolbar */}
            <div className="p-3 border-b border-border/20 dark:border-zinc-800/30 flex flex-col gap-3 bg-muted/10">
                <div className="flex items-center gap-3">
                    <div className="relative flex-1 max-w-sm">
                        <Search className="absolute left-2.5 top-2 text-muted-foreground h-4 w-4" />
                        <input
                            type="text"
                            placeholder={t('monitor.filters.placeholder')}
                            className="flex h-8 w-full rounded-md border border-input bg-background pl-9 pr-3 text-xs ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            value={filter}
                            onChange={(e) => setFilter(e.target.value)}
                        />
                    </div>

                    <div className="relative w-[180px]">
                        <User className="absolute left-2.5 top-2.5 text-muted-foreground h-3.5 w-3.5 z-10" />
                        <Select
                            value={accountFilter || "ALL_ACCOUNTS"}
                            onValueChange={(value) => setAccountFilter(value === "ALL_ACCOUNTS" ? "" : value)}
                        >
                            <SelectTrigger className="h-8 w-full pl-8 text-xs">
                                <SelectValue placeholder={t('monitor.filters.by_account')} />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="ALL_ACCOUNTS">{t('monitor.filters.all_accounts')}</SelectItem>
                                {uniqueAccounts.map(email => (
                                    <SelectItem key={email} value={email || "unknown"}>
                                        {email ? (email.length > 20 ? email.substring(0, 20) + '...' : email) : 'Unknown'}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="hidden lg:flex gap-4 text-[10px] font-medium ml-auto px-2">
                        <span className="text-primary flex items-center gap-1">
                            <span className="font-bold">{formatCompactNumber(stats.total_requests)}</span> Reqs
                        </span>
                        <span className="text-green-600 dark:text-green-400 flex items-center gap-1">
                            <span className="font-bold">{formatCompactNumber(stats.success_count)}</span> Success
                        </span>
                        <span className="text-destructive flex items-center gap-1">
                            <span className="font-bold">{formatCompactNumber(stats.error_count)}</span> Errors
                        </span>
                    </div>

                    <div className="flex items-center gap-1 border-l pl-3 ml-1">
                        <button
                            onClick={() => loadData(currentPage, filter)}
                            disabled={loading}
                            className="h-8 w-8 flex items-center justify-center hover:bg-zinc-100 dark:hover:bg-white/5 rounded-lg transition-all active:scale-95 border border-transparent hover:border-border/40"
                        >
                            <RefreshCw className={cn("h-4 w-4 text-muted-foreground/35", loading && "animate-spin")} />
                        </button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={clearLogs}>
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    </div>
                </div>

                <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
                    <span className="text-[10px] font-medium text-muted-foreground shrink-0">{t('monitor.filters.quick_filters')}</span>
                    {quickFilters.map(q => (
                        <Badge
                            key={q.label}
                            variant={filter === q.value ? "default" : "outline"}
                            className="cursor-pointer hover:bg-secondary font-normal text-[10px] px-2 py-0.5 h-6 transition-all"
                            onClick={() => setFilter(q.value)}
                        >
                            {q.label}
                        </Badge>
                    ))}
                    {(filter || accountFilter) && (
                        <Button variant="link" size="sm" className="h-6 text-[10px] px-1 text-muted-foreground hover:text-primary" onClick={() => { setFilter(''); setAccountFilter(''); }}>
                            {t('monitor.filters.reset')}
                        </Button>
                    )}
                </div>
            </div>

            <LogTable
                logs={filteredLogs}
                loading={loading}
                onLogClick={async (log: ProxyRequestLog) => {
                    setLoadingDetail(true);
                    try {
                        const detail = await invoke<ProxyRequestLog>('get_proxy_log_detail', { logId: log.id });
                        setSelectedLog(detail);
                    } catch (e) {
                        console.error('Failed to load log detail', e);
                        setSelectedLog(log);
                    } finally {
                        setLoadingDetail(false);
                    }
                }}
                t={t}
            />

            {/* Pagination Controls */}
            <div className="flex items-center justify-between px-4 py-2 border-t border-border/20 dark:border-zinc-800/30 bg-muted/20 text-xs">
                <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Rows per page</span>
                    <Select
                        value={String(pageSize)}
                        onValueChange={(value) => setPageSize(Number(value))}
                    >
                        <SelectTrigger className="h-7 w-[70px] text-xs">
                            <SelectValue placeholder={String(pageSize)} />
                        </SelectTrigger>
                        <SelectContent>
                            {PAGE_SIZE_OPTIONS.map(size => (
                                <SelectItem key={size} value={String(size)} className="text-xs">
                                    {size}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div className="flex items-center gap-2">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => goToPage(currentPage - 1)}
                        disabled={currentPage <= 1 || loading}
                    >
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-muted-foreground min-w-[60px] text-center">
                        {currentPage} / {totalPages || 1}
                    </span>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => goToPage(currentPage + 1)}
                        disabled={currentPage >= totalPages || loading}
                    >
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>

                <div className="text-muted-foreground w-[100px] text-right">
                    Total {totalCount}
                </div>
            </div>

            {selectedLog && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setSelectedLog(null)}>
                    <div className="bg-background rounded-xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden border" onClick={e => e.stopPropagation()}>
                        {/* Modal Header */}
                        <div className="px-4 py-3 border-b flex items-center justify-between bg-muted/30">
                            <div className="flex items-center gap-3">
                                {loadingDetail && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                                <Badge variant={selectedLog.status >= 200 && selectedLog.status < 400 ? "default" : "destructive"} className={cn(selectedLog.status >= 200 && selectedLog.status < 400 && "bg-green-600 hover:bg-green-700")}>
                                    {selectedLog.status}
                                </Badge>
                                <span className="font-mono font-semibold text-sm">{selectedLog.method}</span>
                                <span className="text-xs text-muted-foreground font-mono truncate max-w-md hidden sm:inline">{selectedLog.url}</span>
                            </div>
                            <Button variant="ghost" size="icon" className="h-6 w-6 rounded-full" onClick={() => setSelectedLog(null)}>
                                <X className="h-4 w-4" />
                            </Button>
                        </div>

                        {/* Modal Content */}
                        <div className="flex-1 overflow-y-auto p-5 space-y-6">
                            {/* Metadata Section */}
                            <div className="bg-muted/30 p-4 rounded-lg border shadow-sm">
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                                    <div className="space-y-1">
                                        <span className="text-[10px] font-semibold text-muted-foreground tracking-wider">{t('monitor.details.time')}</span>
                                        <div className="font-mono text-xs font-medium">{new Date(selectedLog.timestamp).toLocaleString()}</div>
                                    </div>
                                    <div className="space-y-1">
                                        <span className="text-[10px] font-semibold text-muted-foreground tracking-wider">{t('monitor.details.duration')}</span>
                                        <div className="font-mono text-xs font-medium">{selectedLog.duration}ms</div>
                                    </div>
                                    <div className="space-y-1">
                                        <span className="text-[10px] font-semibold text-muted-foreground tracking-wider">{t('monitor.details.tokens')}</span>
                                        <div className="font-mono text-xs flex gap-2">
                                            <Badge variant="secondary" className="font-normal text-[10px] px-2 bg-blue-500/10 text-blue-600 dark:text-blue-400 border-0">
                                                In: {formatCompactNumber(selectedLog.input_tokens ?? 0)}
                                            </Badge>
                                            <Badge variant="secondary" className="font-normal text-[10px] px-2 bg-green-500/10 text-green-600 dark:text-green-400 border-0">
                                                Out: {formatCompactNumber(selectedLog.output_tokens ?? 0)}
                                            </Badge>
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-4 pt-4 border-t border-border/50 grid grid-cols-1 sm:grid-cols-3 gap-6">
                                    <div className="space-y-1">
                                        <span className="text-[10px] font-semibold text-muted-foreground tracking-wider">{t('monitor.details.protocol')}</span>
                                        <div>
                                            {selectedLog.protocol ? (
                                                <Badge variant="outline" className="font-mono text-[10px]">
                                                    {selectedLog.protocol}
                                                </Badge>
                                            ) : (
                                                <span className="text-xs text-muted-foreground">-</span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="space-y-1 col-span-2">
                                        <span className="text-[10px] font-semibold text-muted-foreground tracking-wider">{t('monitor.details.model')}</span>
                                        <div className="flex items-center gap-2">
                                            <span className="font-mono text-xs font-semibold text-primary">{selectedLog.model || '-'}</span>
                                            {selectedLog.mapped_model && selectedLog.model !== selectedLog.mapped_model && (
                                                <>
                                                    <span className="text-muted-foreground text-[10px]">→</span>
                                                    <span className="font-mono text-xs text-muted-foreground">{selectedLog.mapped_model}</span>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {selectedLog.account_email && (
                                    <div className="mt-4 pt-4 border-t border-border/50">
                                        <span className="text-[10px] font-semibold text-muted-foreground tracking-wider block mb-1">{t('monitor.details.account_used')}</span>
                                        <div className="font-mono text-xs">{selectedLog.account_email}</div>
                                    </div>
                                )}
                            </div>

                            {/* Payloads */}
                            <div className="grid gap-4">
                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <h3 className="text-xs font-semibold text-muted-foreground flex items-center gap-2">{t('monitor.details.request_payload')}</h3>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-6 text-[10px] gap-1.5"
                                            onClick={handleCopyRequest}
                                            disabled={!selectedLog.request_body}
                                        >
                                            {copiedRequestId === selectedLog.id ? (
                                                <CheckCircle className="h-3 w-3 text-green-500" />
                                            ) : (
                                                <Copy className="h-3 w-3" />
                                            )}
                                            {copiedRequestId === selectedLog.id ? t('proxy.config.btn_copied') : t('proxy.config.btn_copy')}
                                        </Button>
                                    </div>
                                    <div className="bg-muted/30 rounded-lg p-3 border overflow-x-auto max-h-[200px] scrollbar-thin">
                                        {formatBody(selectedLog.request_body)}
                                    </div>
                                </div>
                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <h3 className="text-xs font-semibold text-muted-foreground flex items-center gap-2">{t('monitor.details.response_payload')}</h3>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-6 text-[10px] gap-1.5"
                                            onClick={async () => {
                                                if (!selectedLog.response_body) return;
                                                try {
                                                    await navigator.clipboard.writeText(getCopyPayload(selectedLog.response_body));
                                                    setCopiedRequestId(selectedLog.id ? `${selectedLog.id}-response` : null);
                                                    setTimeout(() => {
                                                        setCopiedRequestId((current) =>
                                                            current === `${selectedLog.id}-response` ? null : current
                                                        );
                                                    }, 2000);
                                                } catch (e) {
                                                    console.error('Failed to copy response payload', e);
                                                }
                                            }}
                                            disabled={!selectedLog.response_body}
                                        >
                                            {copiedRequestId === `${selectedLog.id}-response` ? (
                                                <CheckCircle className="h-3 w-3 text-green-500" />
                                            ) : (
                                                <Copy className="h-3 w-3" />
                                            )}
                                            {copiedRequestId === `${selectedLog.id}-response` ? t('proxy.config.btn_copied') : t('proxy.config.btn_copy')}
                                        </Button>
                                    </div>
                                    <div className="bg-muted/30 rounded-lg p-3 border overflow-x-auto max-h-[300px] scrollbar-thin">
                                        {formatBody(selectedLog.response_body)}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <ModalDialog
                isOpen={isClearConfirmOpen}
                title={t('monitor.dialog.clear_title')}
                message={t('monitor.dialog.clear_msg')}
                type="confirm"
                confirmText={t('common.delete')}
                isDestructive={true}
                onConfirm={executeClearLogs}
                onCancel={() => setIsClearConfirmOpen(false)}
            />
        </div>
    );
};
