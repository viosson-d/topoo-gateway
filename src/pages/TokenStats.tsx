import React, { useEffect, useState, useMemo } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useTranslation } from 'react-i18next';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { RefreshCw, Zap, Layers, TrendingUp, Users, Cpu, PieChart as PieChartIcon, Database } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Tabs, TabsList, TabsTrigger } from "../components/ui/tabs";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "../components/ui/table";
import { cn } from '../lib/utils';
import { PageContainer } from '../components/layout/PageContainer';
import { PageHeader } from '../components/layout/PageHeader';

// --- Types ---
interface TokenStatsAggregated {
    period: string;
    total_input_tokens: number;
    total_output_tokens: number;
    total_tokens: number;
    request_count: number;
}

interface AccountTokenStats {
    account_email: string;
    total_input_tokens: number;
    total_output_tokens: number;
    total_tokens: number;
    request_count: number;
}

interface ModelTokenStats {
    model: string;
    total_input_tokens: number;
    total_output_tokens: number;
    total_tokens: number;
    request_count: number;
}

interface ModelTrendPoint {
    period: string;
    model_data: Record<string, number>;
}

interface AccountTrendPoint {
    period: string;
    account_data: Record<string, number>;
}

interface TokenStatsSummary {
    total_input_tokens: number;
    total_output_tokens: number;
    total_tokens: number;
    total_requests: number;
    unique_accounts: number;
}

type TimeRange = 'hourly' | 'daily' | 'weekly';
type ViewMode = 'model' | 'account';

// --- Constants & Helpers ---
const MODEL_COLORS = [
    '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981',
    '#06b6d4', '#6366f1', '#f43f5e', '#84cc16', '#a855f7',
    '#14b8a6', '#f97316', '#64748b', '#0ea5e9', '#d946ef'
];

const COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#06b6d4', '#6366f1', '#f43f5e'];

const formatNumber = (num: number): string => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
};

const shortenModelName = (model: string): string => {
    return model
        .replace('gemini-', 'g-')
        .replace('claude-', 'c-')
        .replace('-preview', '')
        .replace('-latest', '');
};

// --- Custom Tooltips ---
const CustomTrendTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-popover border border-border rounded-lg p-3 shadow-md animate-in zoom-in-95 duration-200">
                <p className="text-xs font-semibold text-muted-foreground mb-2 pb-2 border-b border-border">{label}</p>
                <div className="space-y-1">
                    {payload.map((entry: any, index: number) => (
                        <div key={index} className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                                <span className="text-xs font-medium text-foreground">{entry.name}</span>
                            </div>
                            <span className="text-xs font-bold tabular-nums text-foreground">{entry.value.toLocaleString()}</span>
                        </div>
                    ))}
                </div>
            </div>
        );
    }
    return null;
};

const SimpleCustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-popover border border-border rounded-lg p-2 shadow-sm animate-in fade-in duration-200">
                <p className="text-[10px] font-medium text-muted-foreground mb-1">{label}</p>
                <p className="text-xs font-bold text-foreground">{payload[0].value.toLocaleString()} tokens</p>
            </div>
        );
    }
    return null;
};

const CustomPieTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
        const data = payload[0].payload;
        return (
            <div className="bg-popover border border-border rounded-lg p-2.5 shadow-sm animate-in zoom-in-95 duration-200">
                <p className="text-xs font-medium text-foreground mb-1">{data.name}</p>
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: data.color }} />
                    <p className="text-sm font-bold tabular-nums text-foreground">{data.value.toLocaleString()}</p>
                </div>
            </div>
        );
    }
    return null;
};

// --- Main Component ---
const TokenStats: React.FC = () => {
    const { t } = useTranslation();
    const [timeRange, setTimeRange] = useState<TimeRange>('daily');
    const [viewMode, setViewMode] = useState<ViewMode>('model');
    const [loading, setLoading] = useState(false);
    const [summary, setSummary] = useState<TokenStatsSummary | null>(null);
    const [chartData, setChartData] = useState<TokenStatsAggregated[]>([]);
    const [modelData, setModelData] = useState<ModelTokenStats[]>([]);
    const [accountData, setAccountData] = useState<AccountTokenStats[]>([]);
    const [modelTrendData, setModelTrendData] = useState<ModelTrendPoint[]>([]);
    const [accountTrendData, setAccountTrendData] = useState<AccountTrendPoint[]>([]);
    const [allModels, setAllModels] = useState<string[]>([]);
    const [allAccounts, setAllAccounts] = useState<string[]>([]);

    useEffect(() => {
        fetchData();
    }, [timeRange]);

    const [rebuilding, setRebuilding] = useState(false);

    const rebuildStats = async () => {
        if (!confirm(t('token_stats.confirm_rebuild', 'This will scan all proxy logs and rebuild token statistics. This may take a while. Continue?'))) {
            return;
        }
        setRebuilding(true);
        try {
            const count = await invoke<number>('rebuild_token_stats');
            alert(t('token_stats.rebuild_success', `Successfully rebuilt statistics from ${count} logs.`));
            fetchData();
        } catch (error) {
            console.error('Failed to rebuild stats:', error);
            alert(t('token_stats.rebuild_error', 'Failed to rebuild statistics. Check console for details.'));
        } finally {
            setRebuilding(false);
        }
    };

    const fetchData = async () => {
        setLoading(true);
        try {
            const [
                summaryData,
                aggregatedData,
                mStats,
                aStats,
                mTrend,
                aTrend
            ] = await Promise.all([
                invoke<TokenStatsSummary>('get_token_stats_summary'),
                invoke<TokenStatsAggregated[]>('get_aggregated_token_stats', { range: timeRange }),
                invoke<ModelTokenStats[]>('get_model_token_stats'),
                invoke<AccountTokenStats[]>('get_account_token_stats'),
                invoke<ModelTrendPoint[]>('get_model_usage_trend', { range: timeRange }),
                invoke<AccountTrendPoint[]>('get_account_usage_trend', { range: timeRange })
            ]);

            setSummary(summaryData);
            setChartData(aggregatedData);
            setModelData(mStats);
            setAccountData(aStats);
            setModelTrendData(mTrend);
            setAccountTrendData(aTrend);

            // Extract unique models/accounts for trend lines
            if (mTrend.length > 0) {
                const modelsSet = new Set<string>();
                mTrend.forEach(p => Object.keys(p.model_data).forEach(m => modelsSet.add(m)));
                setAllModels(Array.from(modelsSet));
            }

            if (aTrend.length > 0) {
                const accountsSet = new Set<string>();
                aTrend.forEach(p => Object.keys(p.account_data).forEach(a => accountsSet.add(a)));
                setAllAccounts(Array.from(accountsSet));
            }
        } catch (error) {
            console.error('Failed to fetch token stats:', error);
        } finally {
            setLoading(false);
        }
    };

    const pieData = useMemo(() => {
        if (viewMode === 'account') {
            return accountData.map((acc, index) => ({
                name: acc.account_email,
                value: acc.total_tokens,
                color: COLORS[index % COLORS.length]
            }));
        } else {
            // Calculate provider distribution based on model prefixes
            const providerMap: Record<string, number> = {
                'Gemini': 0,
                'Claude': 0,
                'Other': 0
            };

            modelData.forEach(m => {
                const name = m.model.toLowerCase();
                if (name.includes('gemini')) providerMap['Gemini'] += m.total_tokens;
                else if (name.includes('claude')) providerMap['Claude'] += m.total_tokens;
                else providerMap['Other'] += m.total_tokens;
            });

            return Object.entries(providerMap)
                .filter(([_, value]) => value > 0)
                .map(([name, value], index) => ({
                    name,
                    value,
                    color: index === 0 ? '#3b82f6' : index === 1 ? '#8b5cf6' : '#ec4899'
                }));
        }
    }, [viewMode, accountData, modelData]);



    return (
        <PageContainer className="bg-background/50 p-0 overflow-hidden flex flex-col h-full">
            {/* Sticky Header Container */}
            <div className="sticky top-0 z-30 bg-background/80 backdrop-blur-md px-8 pt-8 pb-2 space-y-4 shrink-0">
                <PageHeader
                    title={t('token_stats.title', 'Token Statistics')}
                    description={t('token_stats.subtitle', 'Detailed insights into your API token usage and costs.')}
                    className="mb-0"
                    sticky={false}
                />

                {/* Time Range Tabs & Refresh */}
                <div className="flex items-center gap-3">
                    <Tabs value={timeRange} onValueChange={(v) => setTimeRange(v as TimeRange)} className="w-[300px]">
                        <TabsList className="grid w-full grid-cols-3">
                            <TabsTrigger value="hourly">
                                {t('token_stats.hourly', 'Hourly')}
                            </TabsTrigger>
                            <TabsTrigger value="daily">
                                {t('token_stats.daily', 'Daily')}
                            </TabsTrigger>
                            <TabsTrigger value="weekly">
                                {t('token_stats.weekly', 'Weekly')}
                            </TabsTrigger>
                        </TabsList>
                    </Tabs>

                    <div className="flex items-center gap-1">
                        <button
                            onClick={rebuildStats}
                            disabled={rebuilding || loading}
                            title={t('token_stats.rebuild', 'Rebuild Statistics from Logs')}
                            className="h-7 w-7 flex items-center justify-center p-0 hover:bg-zinc-100 dark:hover:bg-white/5 rounded-lg transition-all active:scale-95 border border-transparent hover:border-border/40 text-muted-foreground hover:text-foreground"
                        >
                            <Database className={cn("w-3.5 h-3.5", rebuilding && "animate-pulse")} />
                        </button>
                        <button
                            onClick={fetchData}
                            disabled={loading || rebuilding}
                            title={t('common.refresh', 'Refresh')}
                            className="h-7 w-7 flex items-center justify-center p-0 hover:bg-zinc-100 dark:hover:bg-white/5 rounded-lg transition-all active:scale-95 border border-transparent hover:border-border/40"
                        >
                            <RefreshCw className={cn("w-3.5 h-3.5 text-muted-foreground/70", loading && "animate-spin")} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Scrollable Content Area */}
            <div className="flex-1 overflow-y-auto px-8 pb-8 pt-4 space-y-4">
                {/* Summary Cards */}
                {summary && (
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                        <Card className="p-4 flex flex-col justify-between shadow-sm hover:shadow-md transition-shadow duration-200 border-border/40 dark:border-zinc-800/50">
                            <div className="flex items-center gap-2 text-muted-foreground mb-2">
                                <div className="p-1.5 rounded-md bg-muted">
                                    <Zap className="w-3.5 h-3.5 text-foreground" strokeWidth={1.5} />
                                </div>
                                <span className="text-xs font-medium">{t('token_stats.total_tokens', 'Total Tokens')}</span>
                            </div>
                            <div className="text-[20px] font-semibold tracking-tight">{formatNumber(summary.total_tokens)}</div>
                        </Card>

                        <Card className="p-4 flex flex-col justify-between shadow-sm hover:shadow-md transition-shadow duration-200 border-blue-200/40 dark:border-blue-900/40 bg-blue-50/30 dark:bg-blue-900/10">
                            <div className="flex items-center gap-2 text-blue-600/90 dark:text-blue-400 mb-2">
                                <div className="p-1.5 rounded-md bg-blue-100/50 dark:bg-blue-900/30">
                                    <Layers className="w-3.5 h-3.5" strokeWidth={1.5} />
                                </div>
                                <span className="text-xs font-medium">{t('token_stats.total_requests', 'Total Requests')}</span>
                            </div>
                            <div className="text-[20px] font-semibold text-blue-700 dark:text-blue-400">{summary.total_requests.toLocaleString()}</div>
                        </Card>

                        <Card className="p-4 flex flex-col justify-between shadow-sm hover:shadow-md transition-shadow duration-200 border-border/40 dark:border-zinc-800/50">
                            <div className="flex items-center gap-2 text-purple-600/90 dark:text-purple-400 mb-2">
                                <div className="p-1.5 rounded-md bg-purple-100/50 dark:bg-purple-900/30">
                                    <TrendingUp className="w-3.5 h-3.5 rotate-180" strokeWidth={1.5} />
                                </div>
                                <span className="text-xs font-medium">{t('token_stats.input_tokens', 'Input Tokens')}</span>
                            </div>
                            <div className="text-[20px] font-semibold text-purple-700 dark:text-purple-400">{formatNumber(summary.total_input_tokens)}</div>
                        </Card>

                        <Card className="p-4 flex flex-col justify-between shadow-sm hover:shadow-md transition-shadow duration-200 border-border/40 dark:border-zinc-800/50">
                            <div className="flex items-center gap-2 text-green-600/90 dark:text-green-400 mb-2">
                                <div className="p-1.5 rounded-md bg-green-100/50 dark:bg-green-900/30">
                                    <Users className="w-3.5 h-3.5" strokeWidth={1.5} />
                                </div>
                                <span className="text-xs font-medium">{t('token_stats.accounts_used', 'Active Accounts')}</span>
                            </div>
                            <div className="text-[20px] font-semibold text-green-700 dark:text-green-400">{summary.unique_accounts}</div>
                        </Card>

                        <Card className="p-4 flex flex-col justify-between shadow-sm hover:shadow-md transition-shadow duration-200 border-border/40 dark:border-zinc-800/50">
                            <div className="flex items-center gap-2 text-orange-600/90 dark:text-orange-400 mb-2">
                                <div className="p-1.5 rounded-md bg-orange-100/50 dark:bg-orange-900/30">
                                    <Cpu className="w-3.5 h-3.5" strokeWidth={1.5} />
                                </div>
                                <span className="text-xs font-medium">{t('token_stats.models_used', 'Models Used')}</span>
                            </div>
                            <div className="text-[20px] font-semibold text-orange-700 dark:text-orange-400">{modelData.length}</div>
                        </Card>
                    </div>
                )}

                {/* Main Charts Area */}
                <div className="grid grid-cols-1 gap-6">
                    {/* Trend Chart */}
                    <Card className="bg-white/50 dark:bg-white/[0.02] border border-codmate-border dark:border-codmate-border-dark rounded-codmate shadow-codmate">
                        <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                            <div className="flex flex-col gap-0.5">
                                <CardTitle className="text-[13px] font-medium text-foreground/90 tracking-tight leading-snug">
                                    {viewMode === 'model'
                                        ? t('token_stats.model_trend', 'Model Usage Trend')
                                        : t('token_stats.account_trend', 'Account Usage Trend')
                                    }
                                </CardTitle>
                                <CardDescription className="text-[11px] text-muted-foreground/60 leading-snug">
                                    {t('token_stats.trend_subtitle', 'Historical usage data over the selected period')}
                                </CardDescription>
                            </div>

                            <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)}>
                                <TabsList className="h-8">
                                    <TabsTrigger value="model" className="text-xs px-3 h-7">
                                        {t('token_stats.by_model', 'By Model')}
                                    </TabsTrigger>
                                    <TabsTrigger value="account" className="text-xs px-3 h-7">
                                        {t('token_stats.by_account_view', 'By Account')}
                                    </TabsTrigger>
                                </TabsList>
                            </Tabs>
                        </CardHeader>
                        <CardContent>
                            <div className="h-[300px] w-full mt-2">
                                {modelTrendData.length > 0 && (viewMode === 'model' ? allModels.length > 0 : allAccounts.length > 0) ? (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={viewMode === 'model' ? modelTrendData : accountTrendData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" strokeOpacity={0.4} />
                                            <XAxis
                                                dataKey="period"
                                                tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                                                tickFormatter={(val) => {
                                                    if (timeRange === 'hourly') return val.split(' ')[1] || val;
                                                    if (timeRange === 'daily') return val.split('-').slice(1).join('/');
                                                    return val;
                                                }}
                                                axisLine={false}
                                                tickLine={false}
                                                dy={10}
                                            />
                                            <YAxis
                                                tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                                                tickFormatter={(val) => formatNumber(val)}
                                                axisLine={false}
                                                tickLine={false}
                                                width={40}
                                            />
                                            <Tooltip
                                                content={<CustomTrendTooltip />}
                                                cursor={{ stroke: 'hsl(var(--muted-foreground))', strokeWidth: 1, strokeDasharray: '4 4' }}
                                            />
                                            <Legend
                                                formatter={(value) => <span className="text-[10px] font-medium text-foreground ml-1">{viewMode === 'model' ? shortenModelName(value) : value.split('@')[0]}</span>}
                                                wrapperStyle={{ paddingTop: '10px', fontSize: '12px' }}
                                                iconType="circle"
                                                iconSize={8}
                                            />
                                            {(viewMode === 'model' ? allModels : allAccounts).map((item, index) => (
                                                <Area
                                                    key={item}
                                                    type="monotone"
                                                    dataKey={item}
                                                    stackId="1"
                                                    stroke={viewMode === 'model' ? MODEL_COLORS[index % MODEL_COLORS.length] : COLORS[index % COLORS.length]}
                                                    fill={viewMode === 'model' ? MODEL_COLORS[index % MODEL_COLORS.length] : COLORS[index % COLORS.length]}
                                                    fillOpacity={0.5}
                                                    strokeWidth={1.5}
                                                />
                                            ))}
                                        </AreaChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <div className="h-full flex flex-col items-center justify-center text-muted-foreground gap-2">
                                        <Layers className="w-6 h-6 opacity-20" strokeWidth={1.5} />
                                        <span className="text-[12px] font-normal opacity-50">{loading ? t('common.loading', 'Loading...') : t('token_stats.no_data', 'No data available')}</span>
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Bottom Row */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

                    {/* Usage Bar Chart */}
                    <Card className="lg:col-span-2 bg-white/50 dark:bg-white/[0.02] border border-codmate-border dark:border-codmate-border-dark rounded-codmate shadow-codmate">
                        <CardHeader className="pb-2">
                            <div className="flex flex-col gap-0.5">
                                <CardTitle className="text-[13px] font-medium text-foreground/90 tracking-tight leading-snug">
                                    {t('token_stats.usage_trend', 'Token Usage Trend')}
                                </CardTitle>
                                <CardDescription className="text-[11px] text-muted-foreground/60 leading-snug">
                                    {t('token_stats.input_vs_output', 'Breakdown of input vs output tokens')}
                                </CardDescription>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="h-[250px] w-full mt-2">
                                {chartData.length > 0 ? (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" strokeOpacity={0.4} />
                                            <XAxis
                                                dataKey="period"
                                                tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                                                tickFormatter={(val) => {
                                                    if (timeRange === 'hourly') return val.split(' ')[1] || val;
                                                    if (timeRange === 'daily') return val.split('-').slice(1).join('/');
                                                    return val;
                                                }}
                                                axisLine={false}
                                                tickLine={false}
                                                dy={10}
                                            />
                                            <YAxis
                                                tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                                                tickFormatter={(val) => formatNumber(val)}
                                                axisLine={false}
                                                tickLine={false}
                                                width={40}
                                            />
                                            <Tooltip
                                                content={<SimpleCustomTooltip />}
                                                cursor={{ fill: 'hsl(var(--muted)/0.3)' }}
                                                allowEscapeViewBox={{ x: true, y: true }}
                                            />
                                            <Legend
                                                iconType="circle"
                                                iconSize={8}
                                                wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }}
                                                formatter={(value) => <span className="text-[10px] font-medium text-foreground ml-1">{value}</span>}
                                            />
                                            <Bar dataKey="total_input_tokens" name="Input" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={40} />
                                            <Bar dataKey="total_output_tokens" name="Output" fill="#8b5cf6" radius={[4, 4, 0, 0]} maxBarSize={40} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <div className="h-full flex flex-col items-center justify-center text-muted-foreground gap-2">
                                        <Layers className="w-6 h-6 opacity-20" strokeWidth={1.5} />
                                        <span className="text-[12px] font-normal opacity-50">{loading ? t('common.loading', 'Loading...') : t('token_stats.no_data', 'No data available')}</span>
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Distribution Pie Chart */}
                    <Card className="bg-white/50 dark:bg-white/[0.02] border border-codmate-border dark:border-codmate-border-dark rounded-codmate shadow-codmate">
                        <CardHeader className="pb-2">
                            <div className="flex flex-col gap-0.5">
                                <CardTitle className="text-[13px] font-medium text-foreground/90 tracking-tight leading-snug">
                                    {viewMode === 'account' ? t('token_stats.by_account', 'Account Distribution') : t('token_stats.provider_dist', 'Provider Distribution')}
                                </CardTitle>
                                <CardDescription className="text-[11px] text-muted-foreground/60 leading-snug">
                                    {viewMode === 'account' ? t('token_stats.top_accounts', 'Top accounts by usage') : t('token_stats.top_providers', 'Usage by AI provider')}
                                </CardDescription>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="h-[250px] flex flex-col justify-between">
                                {pieData.length > 0 ? (
                                    <>
                                        <div className="h-[180px] w-full mb-4">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <PieChart>
                                                    <Pie
                                                        data={pieData}
                                                        cx="50%"
                                                        cy="50%"
                                                        innerRadius={50}
                                                        outerRadius={75}
                                                        paddingAngle={3}
                                                        dataKey="value"
                                                        stroke="hsl(var(--background))"
                                                        strokeWidth={2}
                                                    >
                                                        {pieData.map((entry, index) => (
                                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                                        ))}
                                                    </Pie>
                                                    <Tooltip content={<CustomPieTooltip />} />
                                                </PieChart>
                                            </ResponsiveContainer>
                                        </div>
                                        <div className="space-y-3 max-h-[140px] overflow-y-auto pr-2 custom-scrollbar">
                                            {pieData.slice(0, 10).map((item) => (
                                                <div key={item.name} className="flex items-center justify-between text-xs">
                                                    <div className="flex items-center gap-2">
                                                        <div
                                                            className="w-2.5 h-2.5 rounded-full shrink-0"
                                                            style={{ backgroundColor: item.color }}
                                                        />
                                                        <span className="text-muted-foreground truncate max-w-[100px] font-medium">
                                                            {viewMode === 'account' ? item.name.split('@')[0] : item.name}
                                                        </span>
                                                    </div>
                                                    <span className="font-semibold tabular-nums text-foreground">
                                                        {formatNumber(item.value)}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </>
                                ) : (
                                    <div className="h-full flex flex-col items-center justify-center text-muted-foreground gap-2">
                                        <PieChartIcon className="w-6 h-6 opacity-20" strokeWidth={1.5} />
                                        <span className="text-[12px] font-normal opacity-50">{loading ? t('common.loading', 'Loading...') : t('token_stats.no_data', 'No data available')}</span>
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Detailed Table Section */}
                {viewMode === 'model' && modelData.length > 0 && (
                    <Card className="bg-white/50 dark:bg-white/[0.02] border border-codmate-border dark:border-codmate-border-dark rounded-codmate shadow-codmate">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-[13px] font-medium text-foreground/90 tracking-tight leading-snug flex items-center gap-2">
                                <Cpu className="w-3.5 h-3.5 text-primary" strokeWidth={1.5} />
                                {t('token_stats.model_details', 'Model Details')}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="rounded-b-lg border-t">
                                <Table>
                                    <TableHeader className="bg-muted/30">
                                        <TableRow className="hover:bg-muted/30">
                                            <TableHead className="w-[30%] text-xs">{t('token_stats.model', 'Model')}</TableHead>
                                            <TableHead className="text-right text-xs text-muted-foreground">{t('token_stats.requests', 'Requests')}</TableHead>
                                            <TableHead className="text-right text-xs text-blue-600 dark:text-blue-400">{t('token_stats.input', 'Input')}</TableHead>
                                            <TableHead className="text-right text-xs text-purple-600 dark:text-purple-400">{t('token_stats.output', 'Output')}</TableHead>
                                            <TableHead className="text-right text-xs">{t('token_stats.total', 'Total')}</TableHead>
                                            <TableHead className="text-right text-xs w-[120px]">{t('token_stats.percentage', 'Share')}</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {modelData.map((model, index) => {
                                            const percentage = summary ? ((model.total_tokens / summary.total_tokens) * 100).toFixed(1) : '0';
                                            return (
                                                <TableRow key={model.model} className="hover:bg-muted/30 transition-colors">
                                                    <TableCell className="font-medium">
                                                        <div className="flex items-center gap-2.5">
                                                            <div
                                                                className="w-2 h-2 rounded-full shrink-0"
                                                                style={{ backgroundColor: MODEL_COLORS[index % MODEL_COLORS.length] }}
                                                            />
                                                            <span className="text-xs font-semibold truncate max-w-[200px]" title={model.model}>{model.model}</span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-right text-xs text-muted-foreground tabular-nums">{model.request_count.toLocaleString()}</TableCell>
                                                    <TableCell className="text-right text-xs text-blue-600/90 dark:text-blue-400/90 tabular-nums">{formatNumber(model.total_input_tokens)}</TableCell>
                                                    <TableCell className="text-right text-xs text-purple-600/90 dark:text-purple-400/90 tabular-nums">{formatNumber(model.total_output_tokens)}</TableCell>
                                                    <TableCell className="text-right text-xs font-bold tabular-nums">{formatNumber(model.total_tokens)}</TableCell>
                                                    <TableCell className="text-right">
                                                        <div className="flex items-center justify-end gap-2">
                                                            <div className="w-16 bg-muted/50 rounded-full h-1.5 overflow-hidden">
                                                                <div
                                                                    className="h-full rounded-full"
                                                                    style={{
                                                                        width: `${percentage}%`,
                                                                        backgroundColor: MODEL_COLORS[index % MODEL_COLORS.length]
                                                                    }}
                                                                />
                                                            </div>
                                                            <span className="text-[10px] font-medium text-muted-foreground w-8 text-right">
                                                                {percentage}%
                                                            </span>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {viewMode === 'account' && accountData.length > 0 && (
                    <Card className="bg-white/50 dark:bg-white/[0.02] border border-codmate-border dark:border-codmate-border-dark rounded-codmate shadow-codmate">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-[13px] font-medium text-foreground/90 tracking-tight leading-snug flex items-center gap-2">
                                <Users className="w-3.5 h-3.5 text-green-600 dark:text-green-500" strokeWidth={1.5} />
                                {t('token_stats.account_details', 'Account Details')}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="rounded-b-lg border-t">
                                <Table>
                                    <TableHeader className="bg-muted/30">
                                        <TableRow className="hover:bg-muted/30">
                                            <TableHead className="w-[40%] text-xs">{t('token_stats.account', 'Account')}</TableHead>
                                            <TableHead className="text-right text-xs text-muted-foreground">{t('token_stats.requests', 'Requests')}</TableHead>
                                            <TableHead className="text-right text-xs text-blue-600 dark:text-blue-400">{t('token_stats.input', 'Input')}</TableHead>
                                            <TableHead className="text-right text-xs text-purple-600 dark:text-purple-400">{t('token_stats.output', 'Output')}</TableHead>
                                            <TableHead className="text-right text-xs">{t('token_stats.total', 'Total')}</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {accountData.map((account) => (
                                            <TableRow key={account.account_email} className="hover:bg-muted/30 transition-colors">
                                                <TableCell className="font-medium text-xs">
                                                    <span className="text-foreground">{account.account_email}</span>
                                                </TableCell>
                                                <TableCell className="text-right text-xs text-muted-foreground tabular-nums">{account.request_count.toLocaleString()}</TableCell>
                                                <TableCell className="text-right text-xs text-blue-600/90 dark:text-blue-400/90 tabular-nums">{formatNumber(account.total_input_tokens)}</TableCell>
                                                <TableCell className="text-right text-xs text-purple-600/90 dark:text-purple-400/90 tabular-nums">{formatNumber(account.total_output_tokens)}</TableCell>
                                                <TableCell className="text-right text-xs font-bold tabular-nums">{formatNumber(account.total_tokens)}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>
                )}
            </div>
        </PageContainer>
    );
};

export default TokenStats;
