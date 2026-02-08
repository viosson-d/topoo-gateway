import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useActivityStore } from "../../stores/useActivityStore";
import { cn } from "../../lib/utils";
import { useTranslation } from "react-i18next";
import { useState } from "react";

export function UsageChart() {
    const { i18n } = useTranslation();
    const { usageHistory, granularity, setGranularity } = useActivityStore();
    const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

    const formatDate = (dateStr: string) => {
        try {
            const date = new Date(dateStr);
            if (granularity === 'minute') {
                return new Intl.DateTimeFormat(i18n.language, { hour: 'numeric', minute: 'numeric' }).format(date);
            } else if (granularity === 'hour') {
                return new Intl.DateTimeFormat(i18n.language, { hour: 'numeric', minute: 'numeric' }).format(date);
            } else {
                return new Intl.DateTimeFormat(i18n.language, { month: 'short', day: 'numeric' }).format(date);
            }
        } catch (e) {
            return dateStr;
        }
    };

    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-white/95 dark:bg-zinc-900/95 border border-border/40 rounded-xl shadow-xl px-2.5 py-1.5 text-[11px] min-w-[140px] font-sans backdrop-blur-md">
                    <p className="font-medium text-muted-foreground/60 border-b border-border/5 pb-0.5 tracking-tight">{formatDate(label)}</p>
                    <div className="space-y-1 pt-1">
                        {payload.map((entry: any, index: number) => (
                            <div key={index} className="flex items-center justify-between gap-3">
                                <span className="flex items-center gap-1.5 text-foreground/80 font-medium">
                                    <div
                                        className="w-1.5 h-1.5 rounded-full shadow-[0_0_8px_rgba(var(--color),0.5)]"
                                        style={{ backgroundColor: entry.color }}
                                    />
                                    {entry.name}
                                </span>
                                <span className="font-semibold tabular-nums text-foreground">{entry.value.toLocaleString()}</span>
                            </div>
                        ))}
                    </div>
                </div>
            );
        }
        return null;
    };

    return (
        <div className="bg-white/50 dark:bg-white/[0.02] border border-codmate-border dark:border-codmate-border-dark rounded-codmate shadow-codmate flex flex-col space-y-4 overflow-hidden">
            {/* Header (Source: headerView in OverviewActivityChart.swift) */}
            <header className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-4">
                    <h2 className="text-[13px] font-medium text-foreground/90 tracking-tight leading-snug">Token Usage</h2>
                    {/* Granularity Picker */}
                    <div className="flex bg-zinc-100/50 dark:bg-white/5 p-0.5 rounded-lg border border-black/[0.03]">
                        {['minute', 'hour', 'day'].map((g) => (
                            <button
                                key={g}
                                onClick={() => setGranularity(g as any)}
                                className={cn(
                                    "px-2.5 py-0.5 rounded-[5px] text-[10px] font-medium capitalize transition-all",
                                    granularity === g
                                        ? "bg-white dark:bg-zinc-800 text-foreground shadow-sm"
                                        : "text-muted-foreground/40 hover:text-muted-foreground/60"
                                )}
                            >
                                {g}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Legend */}
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                        <span className="text-[10px] text-muted-foreground/60">Gemini</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                        <span className="text-[10px] text-muted-foreground/60">Claude</span>
                    </div>
                </div>
            </header>

            {/* Chart Area (Source: chartContainer height 160) */}
            <div className="h-[160px] w-full relative">
                {usageHistory.length === 0 ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-4">
                        <p className="text-[11px] text-muted-foreground/60 mb-1">
                            No activity recorded yet
                        </p>
                        <p className="text-[10px] text-muted-foreground/40 max-w-[200px]">
                            Ensure the gateway is enabled and processing requests to see highlights here.
                        </p>
                    </div>
                ) : (
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={usageHistory} margin={{ top: 10, right: 30, left: -20, bottom: 20 }}>
                            <defs>
                                <linearGradient id="colorGemini" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.1} />
                                    <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                                </linearGradient>
                                <linearGradient id="colorClaude" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#F97316" stopOpacity={0.1} />
                                    <stop offset="95%" stopColor="#F97316" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.03)" />
                            <XAxis
                                dataKey="date"
                                axisLine={false}
                                tickLine={false}
                                tick={granularity === 'minute' ?
                                    (props: any) => {
                                        const { x, y, index, payload } = props;
                                        const isHovered = hoveredIndex === index;
                                        return (
                                            <g
                                                onMouseEnter={() => setHoveredIndex(index)}
                                                onMouseLeave={() => setHoveredIndex(null)}
                                                style={{ cursor: 'pointer' }}
                                            >
                                                {/* 透明悬停热区 */}
                                                <rect
                                                    x={x - 8}
                                                    y={y - 150}
                                                    width={16}
                                                    height={175}
                                                    fill="transparent"
                                                    style={{ pointerEvents: 'all' }}
                                                />
                                                <line
                                                    x1={x}
                                                    y1={y - 150}
                                                    x2={x}
                                                    y2={y + 10}
                                                    stroke="hsl(var(--border))"
                                                    strokeWidth={isHovered ? 1.5 : 0.5}
                                                    opacity={isHovered ? 0.5 : 0.15}
                                                    style={{ pointerEvents: 'none' }}
                                                />
                                                <circle
                                                    cx={x}
                                                    cy={y + 10}
                                                    r={isHovered ? 2.5 : 1.5}
                                                    fill="hsl(var(--muted-foreground))"
                                                    opacity={isHovered ? 0.8 : 0.3}
                                                    style={{ pointerEvents: 'none' }}
                                                />
                                                {isHovered && (
                                                    <text
                                                        x={x}
                                                        y={y + 25}
                                                        textAnchor="middle"
                                                        fontSize={10}
                                                        fill="hsl(var(--foreground))"
                                                        fontWeight={500}
                                                        style={{ pointerEvents: 'none' }}
                                                    >
                                                        {formatDate(payload.value)}
                                                    </text>
                                                )}
                                            </g>
                                        );
                                    } :
                                    { fontSize: 11, fill: 'currentColor', fontWeight: 500 }
                                }
                                className="text-muted-foreground/30"
                                dy={10}
                                tickFormatter={granularity === 'minute' ? () => '' : formatDate}
                                interval={granularity === 'minute' ? 0 : 'preserveStartEnd'}
                            />
                            <YAxis hide domain={[0, 'auto']} />
                            <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'rgba(0,0,0,0.05)', strokeWidth: 1 }} />
                            <Area
                                stackId="1"
                                type="monotone"
                                name="Gemini"
                                dataKey="gemini"
                                stroke="#3B82F6"
                                strokeWidth={1.5}
                                fillOpacity={1}
                                fill="url(#colorGemini)"
                                animationDuration={1000}
                            />
                            <Area
                                stackId="1"
                                type="monotone"
                                name="Claude"
                                dataKey="claude"
                                stroke="#F97316"
                                strokeWidth={1.5}
                                fillOpacity={1}
                                fill="url(#colorClaude)"
                                animationDuration={1000}
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                )}
            </div>
        </div>
    );
}
