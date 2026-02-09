
import { useState, useEffect } from 'react';
import { cn } from "@/lib/utils";
import { getAppVersionDisplay } from '@/utils/version';
import {
    Github,
    User,
    MessageCircle,
    ExternalLink,
    RefreshCw,
    Network,
    UserRound,
    Terminal,
    Heart,
    X
} from 'lucide-react';
import { request as invoke } from '../../utils/request';
import { open } from '@tauri-apps/plugin-dialog';
import { useConfigStore } from '../../stores/useConfigStore';
import { useUIStore } from '../../stores/useUIStore';
import { AppConfig } from '../../types/config';
import { showToast } from '../common/ToastContainer';
import ModalDialog from '../common/ModalDialog';

import { useTranslation } from 'react-i18next';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Switch } from '../ui/switch';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "../ui/select"
import { Label } from '../ui/label';

// Components
import { SettingsCard } from './SettingsCard';
import { SettingsItem } from './SettingsItem';
import QuotaProtection from './QuotaProtection';
import PinnedQuotaModels from './PinnedQuotaModels';
import SmartWarmup from './SmartWarmup';

// Shadcn Dialog
import {
    Dialog,
    DialogContent,
    DialogTitle,
    DialogDescription,
} from "../ui/dialog"
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';

export function SettingsDialog() {
    const { t, i18n } = useTranslation();
    const { config, loadConfig, saveConfig, updateLanguage, updateTheme } = useConfigStore();
    const { isSettingsOpen, setSettingsOpen } = useUIStore();

    // Tabs state
    const [activeTab, setActiveTab] = useState('general');

    const [formData, setFormData] = useState<AppConfig>({
        language: 'zh',
        theme: 'system',
        auto_refresh: false,
        refresh_interval: 15,
        auto_sync: false,
        sync_interval: 5,
        proxy: {
            enabled: false,
            port: 8080,
            api_key: '',
            auto_start: false,
            request_timeout: 60,
            enable_logging: false,
            upstream_proxy: {
                enabled: false,
                url: ''
            }
        },
        scheduled_warmup: {
            enabled: false,
            monitored_models: []
        },
        quota_protection: {
            enabled: false,
            threshold_percentage: 10,
            monitored_models: []
        },
        pinned_quota_models: {
            models: []
        },
        auto_launch: false,
        auto_check_update: true,
        update_check_interval: 24,
        default_export_path: '',
        antigravity_executable: '',
        antigravity_args: [],
        custom_shell_path: ''
    });

    // Local states
    const [dataDirPath, setDataDirPath] = useState<string>('');
    const [httpApiSettings, setHttpApiSettings] = useState<{ enabled: boolean; port: number }>({ enabled: false, port: 11434 });
    const [httpApiPortInput, setHttpApiPortInput] = useState<string>('11434');
    const [httpApiSettingsChanged, setHttpApiSettingsChanged] = useState(false);
    const [isClearLogsOpen, setIsClearLogsOpen] = useState(false);

    // About / Update 
    const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
    const [updateInfo, setUpdateInfo] = useState<{
        hasUpdate: boolean;
        latestVersion: string;
        currentVersion: string;
        downloadUrl: string;
    } | null>(null);

    useEffect(() => {
        if (isSettingsOpen) {
            loadConfig();
            loadSystemInfo();
        }
    }, [isSettingsOpen]);

    const loadSystemInfo = () => {
        // Load data dir
        invoke<string>('get_app_data_dir')
            .then(path => setDataDirPath(path))
            .catch(err => console.error('Failed to get data dir:', err));

        // Load update settings
        invoke<{ auto_check: boolean; last_check_time: number; check_interval_hours: number }>('get_update_settings')
            .then(settings => {
                setFormData(prev => ({
                    ...prev,
                    auto_check_update: settings.auto_check,
                    update_check_interval: settings.check_interval_hours
                }));
            })
            .catch(err => console.error('Failed to load update settings:', err));

        // Get Auto Launch status
        invoke<boolean>('is_auto_launch_enabled')
            .then(enabled => {
                setFormData(prev => ({ ...prev, auto_launch: enabled }));
            })
            .catch(err => console.error('Failed to get auto launch status:', err));

        // Load HTTP API settings
        invoke<{ enabled: boolean; port: number }>('get_http_api_settings')
            .then(settings => {
                setHttpApiSettings(settings);
                setHttpApiPortInput(String(settings.port));
            })
            .catch(err => console.error('Failed to load HTTP API settings:', err));
    };

    useEffect(() => {
        if (config) {
            setFormData(config);
        }
    }, [config]);

    // Auto-save changes
    useEffect(() => {
        const timer = setTimeout(() => {
            if (config && JSON.stringify(formData) !== JSON.stringify(config)) {
                saveConfig(formData);
            }
        }, 800);
        return () => clearTimeout(timer);
    }, [formData, config, saveConfig]);



    // Sidebar config matching P13 Structure
    const sidebarGroups = [
        {
            title: 'Account',
            items: [
                { id: 'general', label: 'General', icon: UserRound },
                { id: 'account', label: 'Account', icon: RefreshCw },
            ]
        },
        {
            title: 'Network',
            items: [
                { id: 'proxy', label: 'Proxy', icon: Network },
            ]
        },
        {
            title: 'System',
            items: [
                { id: 'advanced', label: 'Advanced', icon: Terminal },
                { id: 'about', label: 'About', icon: MessageCircle },
            ]
        }
    ];

    let currentTitle = 'Settings';
    for (const group of sidebarGroups) {
        const item = group.items.find((i) => i.id === activeTab);
        if (item) {
            currentTitle = item.label;
            break;
        }
    }


    // -- GENERAL TAB --
    const renderGeneral = () => (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <SettingsCard title={t('settings.general.title')} description="Basic application settings">
                <SettingsItem title={t('settings.general.language')} description="Select your preferred language">
                    <Select value={formData.language} onValueChange={(value) => { setFormData({ ...formData, language: value }); i18n.changeLanguage(value); updateLanguage(value); }}>
                        <SelectTrigger className="w-[140px] h-8 text-xs"><SelectValue placeholder="Select language" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="zh">简体中文</SelectItem>
                            <SelectItem value="zh-TW">繁體中文</SelectItem>
                            <SelectItem value="en">English</SelectItem>
                            <SelectItem value="ja">日本語</SelectItem>
                            <SelectItem value="tr">Türkçe</SelectItem>
                            <SelectItem value="vi">Tiếng Việt</SelectItem>
                            <SelectItem value="pt">Português</SelectItem>
                            <SelectItem value="ru">Русский</SelectItem>
                        </SelectContent>
                    </Select>
                </SettingsItem>

                <SettingsItem title={t('settings.general.theme')} description="Select the application theme">
                    <Select value={formData.theme} onValueChange={(value) => { setFormData({ ...formData, theme: value as any }); updateTheme(value); }}>
                        <SelectTrigger className="w-[140px] h-8 text-xs"><SelectValue placeholder="Select theme" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="light">{t('settings.general.theme_light')}</SelectItem>
                            <SelectItem value="dark">{t('settings.general.theme_dark')}</SelectItem>
                            <SelectItem value="system">{t('settings.general.theme_system')}</SelectItem>
                        </SelectContent>
                    </Select>
                </SettingsItem>

                {/* Auto Launch */}
                <SettingsItem title={t('settings.general.auto_launch')} description={t('settings.general.auto_launch_desc')}>
                    <Switch size="sm" checked={formData.auto_launch} onCheckedChange={async (checked) => {
                        try {
                            await invoke('toggle_auto_launch', { enable: checked });
                            setFormData({ ...formData, auto_launch: checked });
                            showToast(checked ? t('settings.general.auto_launch_enabled') : t('settings.general.auto_launch_disabled'), 'success');
                        } catch (error) {
                            showToast(`${t('common.error')}: ${error}`, 'error');
                        }
                    }}
                    />
                </SettingsItem>

                <SettingsItem title={t('settings.general.auto_check_update')} description={t('settings.general.auto_check_update_desc')}>
                    <Switch size="sm" checked={formData.auto_check_update ?? true} onCheckedChange={async (checked) => {
                        try {
                            await invoke('save_update_settings', { settings: { auto_check: checked, last_check_time: 0, check_interval_hours: formData.update_check_interval ?? 24 } });
                            setFormData({ ...formData, auto_check_update: checked });
                            showToast(checked ? t('settings.general.auto_check_update_enabled') : t('settings.general.auto_check_update_disabled'), 'success');
                        } catch (error) {
                            showToast(`${t('common.error')}: ${error}`, 'error');
                        }
                    }}
                    />
                </SettingsItem>
            </SettingsCard>
        </div>
    );

    // -- ACCOUNT TAB --
    const renderAccountConfig = () => (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <SettingsCard title="Background Auto Refresh" description="Automatically refresh all account quotas in the background. This is required for quota protection and smart warmup.">
                <SettingsItem
                    title="Background Auto Refresh"
                    description="Automatically refresh all account quotas in the background"
                >
                    <div className="flex items-center gap-4">
                        {formData.auto_refresh && (
                            <div className="flex items-center gap-2 animate-in fade-in slide-in-from-right-2">
                                <span className="text-[11px] font-medium text-muted-foreground/70">Refresh Interval (min)</span>
                                <Input
                                    type="number"
                                    className="w-16 h-7 text-xs"
                                    min="1"
                                    max="1440"
                                    value={formData.refresh_interval || 15}
                                    onChange={(e) => setFormData({ ...formData, refresh_interval: parseInt(e.target.value) || 15 })}
                                />
                            </div>
                        )}
                        <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-secondary text-secondary-foreground border border-border/50">
                            {formData.auto_refresh ? 'Always On' : 'Off'}
                        </span>
                        <Switch size="sm"
                            checked={formData.auto_refresh}
                            onCheckedChange={(checked) => setFormData({ ...formData, auto_refresh: checked })}
                        />
                    </div>
                </SettingsItem>
            </SettingsCard>

            <SettingsCard title="Auto Sync" description="Automatically sync current active account information periodically">
                <SettingsItem
                    title="Auto Sync Current Account"
                    description="Automatically sync current active account information periodically"
                >
                    <Switch size="sm"
                        checked={formData.auto_sync}
                        onCheckedChange={(checked) => setFormData({ ...formData, auto_sync: checked })}
                    />
                </SettingsItem>

            </SettingsCard>

            <SettingsCard title="Automation" description="Smart Warmup and Quota Protection configuration">
                <SmartWarmup
                    config={formData.scheduled_warmup || { enabled: false, monitored_models: [] }}
                    onChange={(newConfig) => setFormData({ ...formData, scheduled_warmup: newConfig })}
                />
                <QuotaProtection
                    config={formData.quota_protection || { enabled: false, threshold_percentage: 10, monitored_models: [] }}
                    onChange={(newConfig) => setFormData({ ...formData, quota_protection: newConfig })}
                />
            </SettingsCard>

            <SettingsCard title="Pinned Models" description="Choose which model quotas to display in the account list">
                <PinnedQuotaModels
                    config={formData.pinned_quota_models || { models: [] }}
                    onChange={(newConfig) => setFormData({ ...formData, pinned_quota_models: newConfig })}
                />
            </SettingsCard>
        </div>
    );

    // -- PROXY TAB --
    const renderProxy = () => (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <SettingsCard title={t('settings.proxy.title')} description={t('proxy.config.upstream_proxy.desc')}>
                <SettingsItem title={t('proxy.config.upstream_proxy.enable')} description="Enable upstream proxy for all requests">
                    <Switch size="sm" checked={formData.proxy?.upstream_proxy?.enabled || false} onCheckedChange={(checked) => setFormData({ ...formData, proxy: { ...formData.proxy, upstream_proxy: { ...formData.proxy.upstream_proxy, enabled: checked } } })} />
                </SettingsItem>
                <div className="px-3 py-2 bg-white dark:bg-muted/5 hover:bg-zinc-50 dark:hover:bg-muted/10 transition-colors space-y-1">
                    <Label className="text-[12px] font-medium text-foreground">{t('proxy.config.upstream_proxy.url')}</Label>
                    <Input type="text" className="h-8 text-xs bg-muted" value={formData.proxy?.upstream_proxy?.url || ''} onChange={(e) => setFormData({ ...formData, proxy: { ...formData.proxy, upstream_proxy: { ...formData.proxy.upstream_proxy, url: e.target.value } } })} placeholder={t('proxy.config.upstream_proxy.url_placeholder')} />
                </div>
            </SettingsCard>
        </div>
    );

    // -- ADVANCED TAB --
    const renderAdvanced = () => (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <SettingsCard title="System Paths" description="Configure file system paths and external executables">
                <div className="px-3 py-2 bg-white dark:bg-muted/5 hover:bg-zinc-50 dark:hover:bg-muted/10 transition-colors space-y-1">
                    <Label className="text-[12px] font-medium text-foreground">{t('settings.advanced.export_path')}</Label>
                    <div className="flex gap-2">
                        <Input value={formData.default_export_path || ''} readOnly className="bg-muted h-8 text-xs" placeholder={t('settings.advanced.export_path_placeholder')} />
                        <Button variant="outline" size="sm" className="h-8 text-xs shrink-0" onClick={async () => {
                            try {
                                // @ts-ignore
                                const selected = await open({ directory: true, multiple: false });
                                if (selected && typeof selected === 'string') setFormData({ ...formData, default_export_path: selected });
                            } catch (e) { showToast(String(e), 'error'); }
                        }}>Select</Button>
                    </div>
                </div>
                <div className="px-3 py-2 bg-white dark:bg-muted/5 hover:bg-zinc-50 dark:hover:bg-muted/10 transition-colors space-y-1">
                    <Label className="text-[12px] font-medium text-foreground">{t('settings.advanced.data_dir')}</Label>
                    <div className="flex gap-2">
                        <Input value={dataDirPath} readOnly className="bg-muted h-8 text-xs" />
                        <Button variant="outline" size="sm" className="h-8 text-xs shrink-0" onClick={() => invoke('open_data_folder')}>Open</Button>
                    </div>
                </div>
                <div className="px-3 py-2 bg-white dark:bg-muted/5 hover:bg-zinc-50 dark:hover:bg-muted/10 transition-colors space-y-1">
                    <Label className="text-[12px] font-medium text-foreground">{t('settings.advanced.antigravity_path')}</Label>
                    <div className="flex gap-2">
                        <Input value={formData.antigravity_executable || ''} onChange={(e) => setFormData({ ...formData, antigravity_executable: e.target.value })} className="h-8 text-xs" placeholder="Path to Antigravity executable" />
                        <Button variant="secondary" size="sm" className="h-8 text-xs shrink-0" onClick={async () => {
                            try {
                                const path = await invoke<string>('get_antigravity_path', { bypassConfig: true });
                                setFormData({ ...formData, antigravity_executable: path });
                                showToast(t('settings.advanced.antigravity_path_detected'), 'success');
                            } catch (e) { showToast(String(e), 'error'); }
                        }}>Detect</Button>
                    </div>
                </div>
            </SettingsCard>

            <SettingsCard title={t('settings.advanced.http_api_title')} description={t('settings.advanced.http_api_desc')}>
                <SettingsItem title={t('settings.advanced.http_api_enabled')} description={t('settings.advanced.http_api_enabled_desc')}>
                    <Switch size="sm" checked={httpApiSettings.enabled} onCheckedChange={(checked) => { setHttpApiSettings(p => ({ ...p, enabled: checked })); setHttpApiSettingsChanged(true); }} />
                </SettingsItem>
                {httpApiSettings.enabled && (
                    <div className="p-4 pt-0 space-y-2">
                        <Label className="text-[12px] font-medium text-foreground">{t('settings.advanced.http_api_port')}</Label>
                        <div className="flex gap-2">
                            <Input
                                type="number"
                                className="w-24 h-8 text-xs"
                                value={httpApiPortInput}
                                onChange={(e) => {
                                    setHttpApiPortInput(e.target.value);
                                    const port = parseInt(e.target.value);
                                    if (port >= 1024 && port <= 65535) {
                                        setHttpApiSettings(p => ({ ...p, port }));
                                        setHttpApiSettingsChanged(true);
                                    }
                                }}
                            />
                            <Button size="sm" className="h-8 text-xs" disabled={!httpApiSettingsChanged} onClick={async () => {
                                try {
                                    await invoke('save_http_api_settings', { settings: httpApiSettings });
                                    setHttpApiSettingsChanged(false);
                                    showToast(t('settings.advanced.http_api_settings_saved'), 'success');
                                } catch (e) { showToast(String(e), 'error'); }
                            }}>{t('common.save')}</Button>
                        </div>
                    </div>
                )}
            </SettingsCard>

            <SettingsCard title="Application Logs" description="Manage local application logs">
                <SettingsItem title={t('settings.advanced.clear_logs')} description={t('settings.advanced.logs_desc')}>
                    <Button variant="outline" size="sm" onClick={() => setIsClearLogsOpen(true)}> {t('settings.advanced.clear_logs')} </Button>
                </SettingsItem>
            </SettingsCard>
        </div>
    );


    // -- ABOUT TAB --
    const handleCheckUpdate = async () => {
        setIsCheckingUpdate(true);
        setUpdateInfo(null);
        try {
            const result = await invoke<{ has_update: boolean; latest_version: string; current_version: string; download_url: string; }>('check_for_updates');
            setUpdateInfo({ hasUpdate: result.has_update, latestVersion: result.latest_version, currentVersion: result.current_version, downloadUrl: result.download_url });
            if (result.has_update) showToast(t('settings.about.new_version_available', { version: result.latest_version }), 'info');
            else showToast(t('settings.about.latest_version'), 'success');
        } catch (e) { showToast(String(e), 'error'); }
        finally { setIsCheckingUpdate(false); }
    };

    const renderAbout = () => (
        <div className="space-y-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="flex flex-col items-center justify-center pt-2 pb-0 opacity-30 hover:opacity-100 transition-all duration-500">
                <img src="/topoo_text_gray.png" alt="Topoo Gateway" className="h-10 w-auto" />
                <span className="text-[10px] font-sans text-muted-foreground/40 mt-0">{getAppVersionDisplay()}</span>
            </div>
            <SettingsCard title="Application" description="App information and updates">
                <div className="flex items-center gap-3 py-1 px-2">
                    <img src="/topoo.png" alt="Logo" className="w-10 h-10 rounded-lg shadow-sm" />
                    <div className="flex-1 space-y-0.5">
                        <h4 className="text-[12px] font-medium text-foreground leading-none">topoo gateway</h4>
                        <p className="text-[11px] text-muted-foreground/70 font-normal">Professional AI Gateway</p>
                    </div>
                </div>

                <SettingsItem title="Software Update" description={updateInfo?.hasUpdate ? "New version available" : "Check for the latest version"}>
                    <div className="flex items-center gap-3">
                        {updateInfo?.hasUpdate && (
                            <a
                                href={updateInfo.downloadUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[11px] font-medium text-blue-500 hover:text-blue-600 transition-colors flex items-center gap-1"
                            >
                                Download {updateInfo.latestVersion}
                                <ExternalLink className="w-3 h-3" />
                            </a>
                        )}
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleCheckUpdate}
                            disabled={isCheckingUpdate}
                            className="h-7 text-[11px] font-medium px-3 gap-1.5"
                        >
                            <RefreshCw className={cn("w-3.5 h-3.5", isCheckingUpdate ? "animate-spin" : "")} />
                            {isCheckingUpdate ? "Checking..." : (updateInfo ? "Check Again" : "Check for Updates")}
                        </Button>
                    </div>
                </SettingsItem>
            </SettingsCard>

            <SettingsCard title="Resources" description="Useful links and credits">
                <SettingsItem title="Source Code" description="View the project on GitHub">
                    <a href="https://github.com/lbjlaq/Antigravity-Manager" target="_blank" rel="noopener noreferrer" title="View Source Code on GitHub">
                        <Button variant="outline" size="sm" className="h-7 w-7 p-0 bg-transparent border-transparent hover:bg-muted/50 hover:border-border transition-all">
                            <Github className="w-4 h-4 text-muted-foreground/80" />
                        </Button>
                    </a>
                </SettingsItem>

                <SettingsItem title="Author" description="Follow viosson">
                    <div className="flex items-center gap-1">
                        <Button variant="outline" size="sm" className="h-7 px-2 text-[11px] bg-transparent border-transparent hover:bg-muted/50 hover:border-border transition-all text-muted-foreground gap-1.5 cursor-default">
                            <User className="w-3.5 h-3.5" />
                            <span>viosson</span>
                        </Button>
                    </div>
                </SettingsItem>

                <SettingsItem title="Support" description="Sponsor the development">
                    <Button variant="outline" size="sm" className="h-7 w-7 p-0 bg-transparent border-transparent hover:bg-muted/50 hover:border-border transition-all cursor-default">
                        <Heart className="w-3.5 h-3.5 text-pink-500/80" />
                    </Button>
                </SettingsItem>
            </SettingsCard>


        </div>
    );

    return (
        <Dialog open={isSettingsOpen} onOpenChange={setSettingsOpen}>
            <DialogContent className="fixed left-[50%] top-[50%] z-50 flex !w-[min(60vw,900px)] !min-w-[680px] sm:!max-w-[1000px] !h-[min(70vh,720px)] !min-h-[520px] !max-h-[800px] translate-x-[-50%] translate-y-[-50%] gap-0 border bg-background p-0 shadow-lg duration-200 sm:rounded-lg [&>button]:hidden overflow-hidden outline-none">
                <VisuallyHidden>
                    <DialogTitle>Settings</DialogTitle>
                    <DialogDescription>Settings</DialogDescription>
                </VisuallyHidden>

                <div className="flex w-full h-full isolate">
                    {/* Sidebar */}
                    <div className="w-[166px] flex-shrink-0 flex flex-col py-[12px] overflow-y-auto bg-background">
                        <div className="px-[12px] mb-[16px]">
                            <h2 className="text-[16px] font-medium text-foreground">
                                Settings
                            </h2>
                        </div>

                        <nav className="flex flex-col px-[12px]">
                            {sidebarGroups.map((group) => (
                                <div key={group.title} className="flex flex-col gap-[4px] mb-[12px]">
                                    <h4 className="px-0 mb-[2px] text-[12px] font-medium text-muted-foreground" style={{ textTransform: 'none' }}>
                                        {group.title}
                                    </h4>
                                    {group.items.map((item) => (
                                        <button
                                            key={item.id}
                                            onClick={() => setActiveTab(item.id)}
                                            className={cn(
                                                'flex items-center gap-[8px] rounded-[6px] px-2 py-1.5 text-[13px] font-medium text-left w-full transition-colors',
                                                activeTab === item.id
                                                    ? 'bg-secondary text-foreground'
                                                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                                            )}
                                        >
                                            <item.icon
                                                className={cn(
                                                    'size-[14px] shrink-0',
                                                    activeTab === item.id ? 'text-foreground' : 'text-muted-foreground'
                                                )}
                                            />
                                            <span style={{ textTransform: 'none' }}>{item.label}</span>
                                        </button>
                                    ))}
                                </div>
                            ))}
                        </nav>
                    </div>

                    {/* Main Content */}
                    <div className="flex-1 flex flex-col min-w-0 h-full bg-muted/10 border-l border-border">
                        {/* Main Header */}
                        <div className="flex items-center justify-between px-[14px] py-[10px] min-h-[44px]">
                            <span className="font-medium text-[14px] text-muted-foreground" style={{ textTransform: 'none' }}>
                                {currentTitle}
                            </span>
                            <button
                                onClick={() => setSettingsOpen(false)}
                                className="h-[16px] w-[16px] p-0 flex items-center justify-center rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                            >
                                <X className="h-4 w-4" />
                                <span className="sr-only">Close</span>
                            </button>
                        </div>

                        {/* Scrollable Body */}
                        <div className="flex-1 overflow-y-auto p-[14px]">
                            <div className="w-full space-y-6">
                                {activeTab === 'general' && renderGeneral()}
                                {activeTab === 'account' && renderAccountConfig()}
                                {activeTab === 'proxy' && renderProxy()}
                                {activeTab === 'advanced' && renderAdvanced()}
                                {activeTab === 'about' && renderAbout()}
                            </div>
                        </div>
                    </div>
                </div>
            </DialogContent>

            {/* Clear Logs Modal */}
            {isClearLogsOpen && (
                <ModalDialog
                    isOpen={isClearLogsOpen}
                    onCancel={() => setIsClearLogsOpen(false)}
                    title={t('settings.advanced.clear_logs')}
                    onConfirm={async () => {
                        try {
                            await invoke('clear_log_cache');
                            showToast(t('settings.advanced.logs_cleared'), 'success');
                        } catch (error) {
                            showToast(`${t('common.error')}: ${error}`, 'error');
                        }
                        setIsClearLogsOpen(false);
                    }}
                    message={t('settings.advanced.clear_logs_confirm')}
                />
            )}
        </Dialog>
    );
}
