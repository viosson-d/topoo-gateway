/**
 * 账号表格组件
 * 支持拖拽排序功能，用户可以通过拖拽行来调整账号顺序
 */
import { useMemo, useState } from 'react';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent,
    DragStartEvent,
    DragOverlay,
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    useSortable,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
    GripVertical,
    ArrowRightLeft,
    RefreshCw,
    Trash2,
    Download,
    Fingerprint,
    Info,
    Lock,
    Ban,
    Diamond,
    Gem,
    Circle,
    Clock,
    ToggleLeft,
    ToggleRight,
    Sparkles,
    MoreHorizontal,
} from 'lucide-react';
import { Account } from '../../types/account';
import { useTranslation } from 'react-i18next';
import { cn } from '../../utils/cn';
import { getQuotaColor, formatTimeRemaining, getTimeRemainingColor } from '../../utils/format';
import { useConfigStore } from '../../stores/useConfigStore';

// ============================================================================
// 类型定义
// ============================================================================

interface AccountTableProps {
    accounts: Account[];
    selectedIds: Set<string>;
    refreshingIds: Set<string>;
    onToggleSelect: (id: string) => void;
    onToggleAll: () => void;
    currentAccountId: string | null;
    switchingAccountId: string | null;
    onSwitch: (accountId: string) => void;
    onRefresh: (accountId: string) => void;
    onViewDevice: (accountId: string) => void;
    onViewDetails: (accountId: string) => void;
    onExport: (accountId: string) => void;
    onDelete: (accountId: string) => void;
    onToggleProxy: (accountId: string) => void;
    onToggleDisabled: (accountId: string, disabled: boolean) => void;
    onWarmup?: (accountId: string) => void;
    /** 拖拽排序回调，当用户完成拖拽时触发 */
    onReorder?: (accountIds: string[]) => void;
}

interface SortableRowProps {
    account: Account;
    selected: boolean;
    isRefreshing: boolean;
    isCurrent: boolean;
    isSwitching: boolean;
    isDragging?: boolean;
    onSelect: () => void;
    onSwitch: () => void;
    onRefresh: () => void;
    onViewDevice: () => void;
    onViewDetails: () => void;
    onExport: () => void;
    onDelete: () => void;
    onToggleProxy: () => void;
    onToggleDisabled: (disabled: boolean) => void;
    onWarmup?: () => void;
}

interface AccountRowContentProps {
    account: Account;
    isCurrent: boolean;
    isRefreshing: boolean;
    isSwitching: boolean;
    onSwitch: () => void;
    onRefresh: () => void;
    onViewDevice: () => void;
    onViewDetails: () => void;
    onExport: () => void;
    onDelete: () => void;
    onToggleProxy: () => void;
    onToggleDisabled: (disabled: boolean) => void;
    onWarmup?: () => void;
}

// ============================================================================
// 辅助函数
// ============================================================================

/**
 * 根据配额百分比获取对应的背景色类名
 */
function getColorClass(percentage: number): string {
    const color = getQuotaColor(percentage);
    switch (color) {
        case 'success': return 'bg-emerald-500';
        case 'warning': return 'bg-amber-500';
        case 'error': return 'bg-rose-500';
        default: return 'bg-gray-500';
    }
}

/**
 * 根据重置时间获取对应的文字色类名
 */
function getTimeColorClass(resetTime: string | undefined): string {
    const color = getTimeRemainingColor(resetTime);
    switch (color) {
        case 'success': return 'text-emerald-500 dark:text-emerald-400';
        case 'warning': return 'text-amber-500 dark:text-amber-400';
        default: return 'text-gray-400 dark:text-gray-500 opacity-60';
    }
}

// ============================================================================
// 模型分组配置
// ============================================================================

const MODEL_GROUPS = {
    CLAUDE: [
        'claude-sonnet-4-5',
        'claude-sonnet-4-5-thinking',
        'claude-opus-4-5-thinking'
    ],
    GEMINI_PRO: [
        'gemini-3-pro-high',
        'gemini-3-pro-low',
        'gemini-3-pro-preview'
    ],
    GEMINI_FLASH: [
        'gemini-3-flash'
    ]
};

function isModelProtected(protectedModels: string[] | undefined, modelName: string): boolean {
    if (!protectedModels || protectedModels.length === 0) return false;
    const lowerName = modelName.toLowerCase();

    // Helper to check if any model in the group is protected
    const isGroupProtected = (group: string[]) => {
        return group.some(m => protectedModels.includes(m));
    };

    // UI Column Keys Mapping (for backward compatibility with hardcoded UI calls)
    if (lowerName === 'gemini-pro') return isGroupProtected(MODEL_GROUPS.GEMINI_PRO);
    if (lowerName === 'gemini-flash') return isGroupProtected(MODEL_GROUPS.GEMINI_FLASH);
    if (lowerName === 'claude-sonnet') return isGroupProtected(MODEL_GROUPS.CLAUDE);

    // 1. Gemini Pro Group
    if (MODEL_GROUPS.GEMINI_PRO.some(m => lowerName === m)) {
        return isGroupProtected(MODEL_GROUPS.GEMINI_PRO);
    }

    // 2. Claude Group
    if (MODEL_GROUPS.CLAUDE.some(m => lowerName === m)) {
        return isGroupProtected(MODEL_GROUPS.CLAUDE);
    }

    // 3. Gemini Flash Group
    if (MODEL_GROUPS.GEMINI_FLASH.some(m => lowerName === m)) {
        return isGroupProtected(MODEL_GROUPS.GEMINI_FLASH);
    }

    // 兜底直接检查 (Strict check for exact match or normalized ID)
    return protectedModels.includes(lowerName);
}

// ============================================================================
// 子组件
// ============================================================================

/**
 * 可拖拽的表格行组件
 * 使用 @dnd-kit/sortable 实现拖拽功能
 */
function SortableAccountRow({
    account,
    selected,
    isRefreshing,
    isCurrent,
    isSwitching,
    isDragging,
    onSelect,
    onSwitch,
    onRefresh,
    onViewDevice,
    onViewDetails,
    onExport,
    onDelete,
    onToggleProxy,
    onToggleDisabled,
    onWarmup,
}: SortableRowProps) {
    const { t } = useTranslation();
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging: isSortableDragging,
    } = useSortable({ id: account.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isSortableDragging ? 0.5 : 1,
        zIndex: isSortableDragging ? 1000 : 'auto',
    };

    return (
        <tr
            ref={setNodeRef}
            style={style as React.CSSProperties}
            className={cn(
                "group transition-all duration-300",
                isCurrent && "bg-blue-50/50 dark:bg-blue-900/10 shadow-[inset_2px_0_0_0_#3b82f6]",
                isDragging && "bg-blue-100 dark:bg-blue-900/30 shadow-lg",
                !isDragging && "hover:bg-slate-50 dark:hover:bg-slate-900/40"
            )}
        >
            {/* 拖拽手柄 */}
            <td className="pl-4 py-2.5 w-8">
                <div
                    {...attributes}
                    {...listeners}
                    className="flex items-center justify-center opacity-0 group-hover:opacity-30 cursor-grab active:cursor-grabbing transition-opacity"
                    title={t('accounts.drag_to_reorder')}
                >
                    <GripVertical className="w-4 h-4" />
                </div>
            </td>
            {/* 复选框 */}
            <td className="px-2 py-2.5 w-10">
                <div
                    className={cn(
                        "w-4 h-4 rounded border transition-all flex items-center justify-center cursor-pointer",
                        selected
                            ? "bg-blue-600 border-blue-600 text-white shadow-sm"
                            : "bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 hover:border-blue-400 dark:hover:border-blue-500 shadow-none"
                    )}
                    onClick={(e) => { e.stopPropagation(); onSelect(); }}
                >
                    {selected && <div className="w-1.5 h-1.5 rounded-full bg-current" />}
                </div>
            </td>
            <AccountRowContent
                account={account}
                isCurrent={isCurrent}
                isRefreshing={isRefreshing}
                isSwitching={isSwitching}
                onSwitch={onSwitch}
                onRefresh={onRefresh}
                onViewDevice={onViewDevice}
                onViewDetails={onViewDetails}
                onExport={onExport}
                onDelete={onDelete}
                onToggleProxy={onToggleProxy}
                onToggleDisabled={onToggleDisabled}
                onWarmup={onWarmup}
            />
        </tr>
    );
}

/**
 * 账号行内容组件
 * 渲染邮箱、配额、最后使用时间和操作按钮等列
 */
function AccountRowContent({
    account,
    isCurrent,
    isRefreshing,
    isSwitching,
    onSwitch,
    onRefresh,
    onViewDevice,
    onViewDetails,
    onExport,
    onDelete,
    onToggleProxy,
    onToggleDisabled,
    onWarmup,
}: AccountRowContentProps) {
    const { t } = useTranslation();
    const { config } = useConfigStore();

    // 模型配置映射：model_id -> { label, protectedKey }
    const MODEL_CONFIG: Record<string, { label: string; protectedKey: string }> = {
        'gemini-3-pro-high': { label: 'G3 Pro', protectedKey: 'gemini-pro' },
        'gemini-3-flash': { label: 'G3 Flash', protectedKey: 'gemini-flash' },
        'gemini-3-pro-image': { label: 'G3 Image', protectedKey: 'gemini-pro-image' },
        'claude-sonnet-4-5-thinking': { label: 'Claude 4.5', protectedKey: 'claude-sonnet' },
    };

    // 获取要显示的模型列表
    const pinnedModels = config?.pinned_quota_models?.models || Object.keys(MODEL_CONFIG);
    const isDisabled = Boolean(account.disabled);
    const isProxyDisabled = Boolean(account.proxy_disabled);

    return (
        <>
            {/* 邮箱列 */}
            <td className="px-4 py-2.5">
                <div className={cn("flex items-center gap-3", isDisabled && "opacity-60")}>
                    <span className={cn(
                        "font-medium text-sm truncate max-w-[180px] xl:max-w-none transition-colors",
                        isCurrent ? "text-blue-700 dark:text-blue-400" : "text-gray-900 dark:text-base-content"
                    )} title={account.email}>
                        {account.email}
                    </span>

                    <div className="flex items-center gap-1.5 shrink-0">
                        {isCurrent && (
                            <span className="px-2 py-0.5 rounded-md bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 text-[10px] font-medium">
                                {t('accounts.current')}
                            </span>
                        )}

                        {isDisabled && (
                            <span
                                className="px-2 py-0.5 rounded-md bg-rose-100 dark:bg-rose-900/50 text-rose-700 dark:text-rose-300 text-[10px] font-medium flex items-center gap-1"
                                title={account.disabled_reason || t('accounts.disabled_tooltip')}
                            >
                                <Ban className="w-2.5 h-2.5" />
                                <span>{t('accounts.disabled')}</span>
                            </span>
                        )}

                        {account.proxy_disabled && (
                            <span
                                className="px-2 py-0.5 rounded-md bg-orange-100 dark:bg-orange-900/50 text-orange-700 dark:text-orange-300 text-[10px] font-medium flex items-center gap-1"
                                title={account.proxy_disabled_reason || t('accounts.proxy_disabled_tooltip')}
                            >
                                <Ban className="w-2.5 h-2.5" />
                                <span>{t('accounts.proxy_disabled')}</span>
                            </span>
                        )}

                        {account.quota?.is_forbidden && (
                            <span className="px-2 py-0.5 rounded-md bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400 text-[10px] font-medium flex items-center gap-1" title={t('accounts.forbidden_tooltip')}>
                                <Lock className="w-2.5 h-2.5" />
                                <span>{t('accounts.forbidden')}</span>
                            </span>
                        )}

                        {/* 订阅类型徽章 */}
                        {account.quota?.subscription_tier && (() => {
                            const tier = account.quota.subscription_tier.toLowerCase();
                            if (tier.includes('ultra')) {
                                return (
                                    <span className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-gradient-to-r from-purple-600 to-pink-600 text-white text-[10px] font-medium hover:scale-105 transition-transform cursor-default">
                                        <Gem className="w-2.5 h-2.5 fill-current" />
                                        Ultra
                                    </span>
                                );
                            } else if (tier.includes('pro')) {
                                return (
                                    <span className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-[10px] font-medium hover:scale-105 transition-transform cursor-default">
                                        <Diamond className="w-2.5 h-2.5 fill-current" />
                                        Pro
                                    </span>
                                );
                            } else {
                                return (
                                    <span className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-gray-400 text-[10px] font-medium hover:bg-gray-200 transition-colors cursor-default">
                                        <Circle className="w-2.5 h-2.5" />
                                        Free
                                    </span>
                                );
                            }
                        })()}
                    </div>
                </div>
            </td>

            {/* 模型配额列 */}
            <td className="px-4 py-2.5">
                {account.quota?.is_forbidden ? (
                    <div className="flex items-center gap-2 text-xs text-red-500 dark:text-red-400 bg-red-50/50 dark:bg-red-900/10 p-1.5 rounded-lg border border-red-100 dark:border-red-900/30">
                        <Ban className="w-4 h-4 shrink-0" />
                        <span>{t('accounts.forbidden_msg')}</span>
                    </div>
                ) : (
                    <div className={cn(
                        "grid gap-x-4 gap-y-1 py-0",
                        pinnedModels.length === 1 ? "grid-cols-1" : "grid-cols-2"
                    )}>
                        {pinnedModels.filter(modelId => MODEL_CONFIG[modelId]).map((modelId) => {
                            const modelConfig = MODEL_CONFIG[modelId];
                            const modelData = account.quota?.models.find(m => m.name.toLowerCase() === modelId);

                            return (
                                <div key={modelId} className="relative h-[22px] flex items-center px-2 border-l-2 bg-transparent overflow-hidden group/quota transition-all"
                                    style={{ borderLeftColor: modelData ? `var(--tw-text-opacity, 1) ${getQuotaColor(modelData.percentage) === 'success' ? '#10b981' : getQuotaColor(modelData.percentage) === 'warning' ? '#f59e0b' : '#f43f5e'}` : 'transparent' }}>

                                    {/* Subtle Progress Bar */}
                                    {modelData && (
                                        <div
                                            className={cn("absolute inset-y-0 left-0 opacity-[0.03] dark:opacity-[0.06] transition-all duration-700 ease-out", getColorClass(modelData.percentage))}
                                            style={{ width: `${modelData.percentage}%` }}
                                        />
                                    )}

                                    <div className="relative z-10 w-full flex items-center text-[10px] font-mono leading-none">
                                        <span className="min-w-[54px] max-w-[72px] text-slate-500 dark:text-slate-400 font-medium truncate pr-1" title={modelId}>
                                            {modelConfig.label}
                                        </span>
                                        <div className="flex-1 flex justify-center">
                                            {modelData?.reset_time ? (
                                                <span className={cn("flex items-center gap-0.5 font-medium transition-colors", getTimeColorClass(modelData.reset_time))}>
                                                    <Clock className="w-2.5 h-2.5" />
                                                    {formatTimeRemaining(modelData.reset_time)}
                                                </span>
                                            ) : (
                                                <span className="text-slate-300 dark:text-slate-600 italic scale-90">---</span>
                                            )}
                                        </div>
                                        <span className={cn("w-[36px] text-right font-medium transition-colors flex items-center justify-end gap-0.5",
                                            getQuotaColor(modelData?.percentage || 0) === 'success' ? 'text-emerald-600 dark:text-emerald-400' :
                                                getQuotaColor(modelData?.percentage || 0) === 'warning' ? 'text-amber-600 dark:text-amber-400' : 'text-rose-600 dark:text-rose-400'
                                        )}>
                                            {isModelProtected(account.protected_models, modelConfig.protectedKey) && (
                                                <span title={t('accounts.quota_protected')}><Lock className="w-2.5 h-2.5 text-amber-500" /></span>
                                            )}
                                            {modelData ? `${modelData.percentage}%` : '-'}
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </td>

            {/* 最后使用时间列 */}
            <td className={cn("px-4 py-2.5", isDisabled && "opacity-50")}>
                <div className="flex flex-col">
                    <span className="text-xs font-medium text-gray-600 dark:text-gray-400 font-mono whitespace-nowrap">
                        {new Date(account.last_used * 1000).toLocaleDateString()}
                    </span>
                    <span className="text-[10px] text-gray-400 dark:text-gray-500 font-mono whitespace-nowrap leading-tight">
                        {new Date(account.last_used * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                </div>
            </td>

            <td className={cn(
                "px-6 py-2.5 sticky right-0 z-10 shadow-[-12px_0_12px_-12px_rgba(0,0,0,0.1)] dark:shadow-[-12px_0_12px_-12px_rgba(255,255,255,0.05)] text-center transition-colors",
                "bg-white/80 dark:bg-slate-950/80 backdrop-blur-md",
                isCurrent && "bg-blue-50/80 dark:bg-blue-900/40",
                !isCurrent && "group-hover:bg-slate-50 dark:group-hover:bg-slate-900/80"
            )}>
                <div className="flex items-center justify-center gap-1.5 group-hover:opacity-100 transition-opacity">
                    {/* 主要操作按钮 */}
                    <button
                        className={`btn btn-ghost btn-xs flex items-center gap-1.5 h-8 px-2.5 min-w-[80px] rounded-lg transition-all ${(isSwitching || isDisabled) ? 'bg-blue-50/50 dark:bg-blue-900/10 text-blue-400 dark:text-blue-600 cursor-not-allowed' : 'text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/40'}`}
                        onClick={(e) => { e.stopPropagation(); onSwitch(); }}
                        title={isDisabled ? t('accounts.disabled_tooltip') : (isSwitching ? t('common.loading') : t('accounts.switch_to'))}
                        disabled={isSwitching || isDisabled}
                    >
                        <ArrowRightLeft className={`w-3.5 h-3.5 ${isSwitching ? 'animate-spin' : ''}`} />
                        <span className="text-[11px] font-medium">{t('accounts.switch_to')}</span>
                    </button>

                    {/* 更多操作下拉菜单 */}
                    <div className="dropdown dropdown-left dropdown-end">
                        <label tabIndex={0} className="btn btn-ghost btn-xs h-8 w-8 p-0 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                            <MoreHorizontal className="w-4 h-4 text-slate-500" />
                        </label>
                        <ul tabIndex={0} className="dropdown-content z-[100] menu p-1.5 shadow-premium-float bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/60 rounded-xl w-52 mt-1">
                            {/* 查看详情 */}
                            <li>
                                <button onClick={(e) => { e.stopPropagation(); onViewDetails(); }} className="flex items-center gap-2.5 py-2 px-3 hover:bg-blue-50/50 dark:hover:bg-blue-900/20 text-slate-700 dark:text-slate-300 rounded-lg transition-colors">
                                    <Info className="w-4 h-4 text-sky-500" />
                                    <span className="text-sm font-medium">{t('common.details')}</span>
                                </button>
                            </li>
                            {/* 硬件指纹 */}
                            <li>
                                <button onClick={(e) => { e.stopPropagation(); onViewDevice(); }} className="flex items-center gap-2.5 py-2 px-3 hover:bg-blue-50/50 dark:hover:bg-blue-900/20 text-slate-700 dark:text-slate-300 rounded-lg transition-colors">
                                    <Fingerprint className="w-4 h-4 text-indigo-500" />
                                    <span className="text-sm font-medium">{t('accounts.device_fingerprint')}</span>
                                </button>
                            </li>
                            <li className="h-px bg-slate-100 dark:bg-slate-800 my-1 mx-2 list-none" />
                            {/* 刷新额度 */}
                            <li>
                                <button
                                    onClick={(e) => { e.stopPropagation(); onRefresh(); }}
                                    disabled={isRefreshing || isDisabled}
                                    className={cn("flex items-center gap-2.5 py-2 px-3 rounded-lg transition-colors", (isRefreshing || isDisabled) ? "opacity-50 cursor-not-allowed" : "hover:bg-green-50/50 dark:hover:bg-green-900/20 text-slate-700 dark:text-slate-300")}
                                >
                                    <RefreshCw className={cn("w-4 h-4 text-emerald-500", isRefreshing && "animate-spin")} />
                                    <span className="text-sm font-medium">{t('common.refresh')}</span>
                                </button>
                            </li>
                            {/* 热身账号 */}
                            {onWarmup && (
                                <li>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); onWarmup(); }}
                                        disabled={isRefreshing || isDisabled}
                                        className={cn("flex items-center gap-2.5 py-2 px-3 rounded-lg transition-colors", (isRefreshing || isDisabled) ? "opacity-50 cursor-not-allowed" : "hover:bg-orange-50/50 dark:hover:bg-orange-900/20 text-slate-700 dark:text-slate-300")}
                                    >
                                        <Sparkles className={cn("w-4 h-4 text-orange-500", isRefreshing && "animate-pulse")} />
                                        <span className="text-sm font-medium">{t('accounts.warmup_this')}</span>
                                    </button>
                                </li>
                            )}
                            <li className="h-px bg-slate-100 dark:bg-slate-800 my-1 mx-2 list-none" />
                            {/* 代理开关 (Toggle Proxy) */}
                            <li>
                                <button onClick={(e) => { e.stopPropagation(); onToggleProxy(); }} className="flex items-center gap-2.5 py-2 px-3 hover:bg-orange-50/50 dark:hover:bg-orange-900/20 text-slate-700 dark:text-slate-300 rounded-lg transition-colors">
                                    {isProxyDisabled ? (
                                        <ToggleRight className="w-4 h-4 text-emerald-500" />
                                    ) : (
                                        <ToggleLeft className="w-4 h-4 text-orange-500" />
                                    )}
                                    <span className="text-sm font-medium">{isProxyDisabled ? t('accounts.enable_proxy') : t('accounts.disable_proxy')}</span>
                                </button>
                            </li>
                            {/* 账号禁用 (Manual Disable) */}
                            <li>
                                <button onClick={(e) => { e.stopPropagation(); onToggleDisabled(!isDisabled); }} className="flex items-center gap-2.5 py-2 px-3 hover:bg-rose-50/50 dark:hover:bg-rose-900/20 text-slate-700 dark:text-slate-300 rounded-lg transition-colors">
                                    {isDisabled ? (
                                        <ToggleRight className="w-4 h-4 text-emerald-500" />
                                    ) : (
                                        <Lock className="w-4 h-4 text-rose-500" />
                                    )}
                                    <span className="text-sm font-medium">{isDisabled ? t('accounts.enable_account') : t('accounts.disable_account_manual')}</span>
                                </button>
                            </li>
                            <li className="h-px bg-slate-100 dark:bg-slate-800 my-1 mx-2 list-none" />
                            {/* 导出 */}
                            <li>
                                <button onClick={(e) => { e.stopPropagation(); onExport(); }} className="flex items-center gap-2.5 py-2 px-3 hover:bg-indigo-50/50 dark:hover:bg-indigo-900/20 text-slate-700 dark:text-slate-300 rounded-lg transition-colors">
                                    <Download className="w-4 h-4 text-indigo-500" />
                                    <span className="text-sm font-medium">{t('common.export')}</span>
                                </button>
                            </li>
                            {/* 删除 */}
                            <li>
                                <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="flex items-center gap-2.5 py-2 px-3 hover:bg-red-50/50 dark:hover:bg-red-900/20 text-rose-600 dark:text-rose-400 rounded-lg transition-colors">
                                    <Trash2 className="w-4 h-4" />
                                    <span className="text-sm font-medium">{t('common.delete')}</span>
                                </button>
                            </li>
                        </ul>
                    </div>
                </div>
            </td>
        </>
    );
}

// ============================================================================
// 主组件
// ============================================================================

/**
 * 账号表格组件
 * 支持拖拽排序、多选、批量操作等功能
 */
function AccountTable({
    accounts,
    selectedIds,
    refreshingIds,
    onToggleSelect,
    onToggleAll,
    currentAccountId,
    switchingAccountId,
    onSwitch,
    onRefresh,
    onViewDevice,
    onViewDetails,
    onExport,
    onDelete,
    onToggleProxy,
    onToggleDisabled,
    onReorder,
}: AccountTableProps) {
    const { t } = useTranslation();
    const [activeId, setActiveId] = useState<string | null>(null);

    // 配置拖拽传感器
    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: { distance: 8 }, // 需要移动 8px 才触发拖拽
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const accountIds = useMemo(() => accounts.map(a => a.id), [accounts]);
    const activeAccount = useMemo(() => accounts.find(a => a.id === activeId), [accounts, activeId]);

    const handleDragStart = (event: DragStartEvent) => {
        setActiveId(event.active.id as string);
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        setActiveId(null);

        if (over && active.id !== over.id) {
            const oldIndex = accountIds.indexOf(active.id as string);
            const newIndex = accountIds.indexOf(over.id as string);

            if (oldIndex !== -1 && newIndex !== -1 && onReorder) {
                onReorder(arrayMove(accountIds, oldIndex, newIndex));
            }
        }
    };

    if (accounts.length === 0) {
        return (
            <div className="bg-white dark:bg-base-100 p-12 text-center">
                <p className="text-gray-400 mb-2">{t('accounts.empty.title')}</p>
                <p className="text-sm text-gray-400">{t('accounts.empty.desc')}</p>
            </div>
        );
    }

    return (
        <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
        >
            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead>
                        <tr className="border-b border-slate-100 dark:border-slate-800/60">
                            <th className="pl-4 py-3 text-left w-8">
                                <span className="sr-only">{t('accounts.drag_to_reorder')}</span>
                            </th>
                            <th className="px-2 py-3 text-left w-10">
                                <div
                                    className={cn(
                                        "w-4 h-4 rounded border transition-all flex items-center justify-center cursor-pointer",
                                        accounts.length > 0 && selectedIds.size === accounts.length
                                            ? "bg-blue-600 border-blue-600 text-white shadow-sm"
                                            : "bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 hover:border-blue-400 dark:hover:border-blue-500 shadow-none"
                                    )}
                                    onClick={(e) => { e.stopPropagation(); onToggleAll(); }}
                                >
                                    {accounts.length > 0 && selectedIds.size === accounts.length && <div className="w-1.5 h-1.5 rounded-full bg-current" />}
                                </div>
                            </th>
                            <th className="px-4 py-3.5 text-left text-[11px] font-medium text-slate-500/80 dark:text-slate-400/80 tracking-tight whitespace-nowrap">
                                <div className="flex items-center gap-2">
                                    {t('accounts.table.email')}
                                </div>
                            </th>
                            <th className="px-4 py-3.5 text-left text-[11px] font-medium text-slate-500/80 dark:text-slate-400/80 tracking-tight w-[440px] min-w-[360px] whitespace-nowrap">
                                {t('accounts.table.quota')}
                            </th>
                            <th className="px-4 py-3.5 text-left text-[11px] font-medium text-slate-500/80 dark:text-slate-400/80 tracking-tight whitespace-nowrap text-center">
                                {t('accounts.table.status')}
                            </th>
                            <th className="px-4 py-3.5 text-left text-[11px] font-medium text-slate-500/80 dark:text-slate-400/80 tracking-tight whitespace-nowrap">{t('accounts.table.last_used')}</th>
                            <th className="px-4 py-3.5 text-left text-[11px] font-medium text-slate-500/80 dark:text-slate-400/80 tracking-tight whitespace-nowrap sticky right-0 z-20 shadow-[-12px_0_12px_-12px_rgba(0,0,0,0.1)] dark:shadow-[-12px_0_12px_-12px_rgba(255,255,255,0.05)] text-center bg-slate-50/80 dark:bg-slate-900/80 backdrop-blur-md">
                                {t('accounts.table.actions')}
                            </th>
                        </tr>
                    </thead>
                    <SortableContext items={accountIds} strategy={verticalListSortingStrategy}>
                        <tbody className="divide-y divide-gray-100 dark:divide-base-200">
                            {accounts.map((account) => (
                                <SortableAccountRow
                                    key={account.id}
                                    account={account}
                                    selected={selectedIds.has(account.id)}
                                    isRefreshing={refreshingIds.has(account.id)}
                                    isCurrent={account.id === currentAccountId}
                                    isSwitching={account.id === switchingAccountId}
                                    isDragging={account.id === activeId}
                                    onSelect={() => onToggleSelect(account.id)}
                                    onSwitch={() => onSwitch(account.id)}
                                    onRefresh={() => onRefresh(account.id)}
                                    onViewDevice={() => onViewDevice(account.id)}
                                    onViewDetails={() => onViewDetails(account.id)}
                                    onExport={() => onExport(account.id)}
                                    onDelete={() => onDelete(account.id)}
                                    onToggleProxy={() => onToggleProxy(account.id)}
                                    onToggleDisabled={(disabled) => onToggleDisabled(account.id, disabled)}
                                />
                            ))}
                        </tbody>
                    </SortableContext>
                </table>
            </div>

            {/* 拖拽悬浮预览层 */}
            <DragOverlay>
                {activeAccount ? (
                    <table className="w-full bg-white dark:bg-base-100 shadow-2xl rounded-lg border border-blue-200 dark:border-blue-800">
                        <tbody>
                            <tr className="bg-blue-50 dark:bg-blue-900/30">
                                <td className="pl-2 py-1 w-8">
                                    <div className="flex items-center justify-center w-6 h-6 text-blue-500">
                                        <GripVertical className="w-4 h-4" />
                                    </div>
                                </td>
                                <td className="px-2 py-1 w-10">
                                    <input
                                        type="checkbox"
                                        title={t('common.select_all', 'Select All')}
                                        className="checkbox checkbox-sm rounded border-2 border-gray-400 dark:border-gray-500 checked:border-blue-600 checked:bg-blue-600 [--chkbg:theme(colors.blue.600)] [--chkfg:white]"
                                        checked={selectedIds.has(activeAccount.id)}
                                        readOnly
                                    />
                                </td>
                                <AccountRowContent
                                    account={activeAccount}
                                    isCurrent={activeAccount.id === currentAccountId}
                                    isRefreshing={refreshingIds.has(activeAccount.id)}
                                    isSwitching={activeAccount.id === switchingAccountId}
                                    onSwitch={() => { }}
                                    onRefresh={() => { }}
                                    onViewDevice={() => { }}
                                    onViewDetails={() => { }}
                                    onExport={() => { }}
                                    onDelete={() => { }}
                                    onToggleProxy={() => { }}
                                    onToggleDisabled={() => { }}
                                />
                            </tr>
                        </tbody>
                    </table>
                ) : null}
            </DragOverlay>
        </DndContext>
    );
}

export default AccountTable;
