import { Link, useLocation } from 'react-router-dom';
import {
    LayoutDashboard,
    Users,
    Settings,
    Activity,
    LineChart,
    ChevronRight,
    Box,
    ChevronDown
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../lib/utils';
import { getAppVersionDisplay } from '../../utils/version';
import { Button } from '../ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../ui/collapsible';
import { motion, LayoutGroup } from 'framer-motion';
import { useUIStore } from '../../stores/useUIStore';

const NAV_ITEM_CLASS = "w-full justify-start h-8 px-1.5 gap-2 text-[13px] font-normal rounded-lg text-[#404040] dark:text-slate-200 hover:bg-white dark:hover:bg-zinc-800 transition-colors border border-transparent";

export function Sidebar({ className }: { className?: string }) {
    const location = useLocation();
    const { t } = useTranslation();

    const isActive = (path: string) => {
        if (path === '/') return location.pathname === '/';
        return location.pathname.startsWith(path);
    };

    return (
        <aside className={cn("w-[240px] border-r bg-zinc-50/50 dark:bg-zinc-950 flex flex-col h-full relative font-sans", className)}>
            <LayoutGroup id="sidebar-nav">
                {/* macOS Traffic Light Spacer - 保持顶部干净留白 */}
                <div className="h-9 shrink-0 select-none" data-tauri-drag-region />

                {/* Brand Header */}
                <div className="px-2 pt-0 pb-2 mb-1">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-white dark:bg-slate-800 flex items-center justify-center p-0.5 shadow-sm border border-slate-200/50">
                            <img src="/topoo.png" alt="Logo" className="w-full h-full object-contain rounded-sm" />
                        </div>
                        <div className="min-w-0 flex flex-col justify-center">
                            <h2 className="font-semibold text-sm leading-none text-foreground tracking-tight force-no-transform" style={{ textTransform: 'none' }}>topoo Gateway</h2>
                            <p className="text-[11px] text-muted-foreground/80 leading-tight mt-0.5"><span className="text-muted-foreground/50 text-[10px]">{getAppVersionDisplay()}</span></p>
                        </div>
                    </div>
                </div>

                {/* Main Navigation Groups */}
                <div className="flex-1 overflow-y-auto px-1 space-y-1">

                    <div className="flex flex-col gap-0">
                        {/* Section Header */}
                        <div className="px-1.5 h-6 flex flex-col justify-center">
                            <span className="text-[10px] font-medium text-zinc-400 dark:text-zinc-600 pl-1">Gateway</span>
                        </div>

                        <Collapsible defaultOpen className="space-y-0.5">
                            <div className="flex items-center w-full relative group">
                                <Button
                                    asChild
                                    variant="ghost"
                                    className={cn(
                                        NAV_ITEM_CLASS,
                                        isActive('/') && "bg-white dark:bg-zinc-800 font-medium"
                                    )}
                                >
                                    <Link to="/">
                                        <div className="w-6 h-6 flex items-center justify-center shrink-0">
                                            <LayoutDashboard className={cn("w-[13px] h-[13px] text-[#404040] dark:text-slate-200")} strokeWidth={1.5} />
                                        </div>
                                        <span className="truncate flex-1 text-left">Dashboard</span>
                                    </Link>
                                </Button>

                                <CollapsibleTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-6 w-6 absolute right-1 hover:bg-transparent text-muted-foreground/50 hover:text-foreground">
                                        <ChevronDown className="h-3.5 w-3.5 transition-transform data-[state=closed]:-rotate-90" strokeWidth={1.5} />
                                        <span className="sr-only">Toggle</span>
                                    </Button>
                                </CollapsibleTrigger>
                            </div>

                            {/* Subitems container matching design */}
                            <CollapsibleContent>
                                <div className="pl-2 py-[2px] ml-[18px] border-l border-[#E5E5E5] dark:border-slate-800 flex flex-col gap-1 mt-1">
                                    <NavItem to="/accounts" icon={Users} label={t('nav.accounts')} active={isActive('/accounts')} isSubItem />
                                    <NavItem to="/monitor" icon={Activity} label={t('nav.traffic_logs')} active={isActive('/monitor')} isSubItem />
                                    <NavItem to="/token-stats" icon={LineChart} label={t('nav.token_stats')} active={isActive('/token-stats')} isSubItem />
                                </div>
                            </CollapsibleContent>
                        </Collapsible>

                        {/* API Proxy - standalone item */}
                        <NavItem to="/api-proxy" icon={Box} label={t('nav.proxy')} active={isActive('/api-proxy')} />
                    </div>

                </div>

                {/* System Group - moved outside flex-1 for true bottom alignment */}
                <div className="px-1 pb-1">
                    <div className="flex flex-col gap-0">
                        <div className="px-1.5 h-6 flex flex-col justify-center opacity-70">
                            <span className="text-[10px] font-medium text-zinc-400 dark:text-zinc-600 pl-1">System</span>
                        </div>
                        {/* Settings Button */}
                        <div className="relative flex items-center">
                            <Button
                                variant="ghost"
                                className={cn(NAV_ITEM_CLASS, "cursor-pointer")}
                                onClick={() => useUIStore.getState().setSettingsOpen(true)}
                            >
                                <div className="w-6 h-6 flex items-center justify-center shrink-0">
                                    <Settings className="w-[13px] h-[13px] text-[#404040] dark:text-slate-200" strokeWidth={1.5} />
                                </div>
                                <span className="truncate flex-1 text-left">{t('nav.settings')}</span>
                                <ChevronRight className="w-3 h-3 absolute right-1.5 text-muted-foreground/30 group-hover:text-muted-foreground/70" />
                            </Button>
                        </div>
                    </div>
                </div>

                {/* Sidebar Footer - User Profile */}
                <div className="mt-auto p-1 border-t border-border/40 bg-slate-50/50 dark:bg-slate-900/10 h-[64px] flex items-center justify-center">
                    <Button variant="ghost" className="w-full h-[48px] p-1.5 gap-2 hover:bg-white dark:hover:bg-slate-800/50 transition-all duration-200 rounded-[6px] group/user flex flex-row items-center border-none">
                        <div className="w-7 h-7 rounded-[8px] overflow-hidden bg-white dark:bg-slate-800 shadow-sm shrink-0 relative">
                            <img
                                src="https://api.dicebear.com/7.x/avataaars/svg?seed=vi&backgroundColor=b6e3f4"
                                alt="Avatar"
                                className="w-full h-full object-cover"
                            />
                        </div>
                        <div className="flex-1 text-left min-w-0 flex flex-col justify-center h-8">
                            <h4 className="font-medium text-[13px] leading-[18px] truncate text-[#404040] dark:text-slate-200">viossion</h4>
                            <p className="text-[11px] font-light leading-[14px] text-[#404040]/80 dark:text-slate-400 truncate">wissen.damon@gmail.com</p>
                        </div>
                        <ChevronDown className="w-3 h-3 text-[#404040] dark:text-slate-400 shrink-0" />
                    </Button>
                </div>
            </LayoutGroup>
        </aside>
    );
}

function NavItem({ to, icon: Icon, label, active, isSubItem, hasChevron }: any) {
    // SubItem specific style override for height: 28px
    const finalClass = isSubItem
        ? "w-full justify-start h-[26px] px-1.5 gap-2 text-[13px] font-normal rounded-[6px] text-[#404040] dark:text-slate-200 hover:bg-white dark:hover:bg-white/10 transition-colors duration-200"
        : "w-full justify-start h-8 px-1.5 gap-2 text-[13px] font-normal rounded-lg text-[#404040] dark:text-slate-200 hover:bg-white dark:hover:bg-zinc-800 transition-colors border border-transparent";


    return (
        <div className="relative flex items-center">
            {isSubItem && active && (
                <motion.div
                    layoutId="active-sub-indicator"
                    className="absolute -left-[9px] top-[7px] h-[16px] w-[2px] bg-[#404040] dark:bg-slate-200 rounded-full"
                    transition={{
                        type: "spring",
                        stiffness: 380,
                        damping: 30
                    }}
                />
            )}
            <Button
                asChild
                variant="ghost"
                className={cn(
                    finalClass,
                    active && "bg-white dark:bg-zinc-800 font-medium"
                )}
            >
                <Link to={to}>
                    <div className="w-6 h-6 flex items-center justify-center shrink-0">
                        <Icon
                            className={cn(
                                "w-[13px] h-[13px] transition-colors duration-200",
                                active ? "text-[#404040] dark:text-slate-200" : "text-[#404040] dark:text-slate-200"
                            )}
                            strokeWidth={1.5}
                        />
                    </div>
                    <span className="truncate flex-1 text-left">
                        {label}
                    </span>
                    {hasChevron && <ChevronRight className="w-3 h-3 absolute right-1.5 text-muted-foreground/30 group-hover:text-muted-foreground/70" />}
                </Link>
            </Button>
        </div>
    );
}
