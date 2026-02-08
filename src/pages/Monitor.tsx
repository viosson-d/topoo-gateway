import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ProxyMonitor } from '../components/proxy/ProxyMonitor';
import { PageContainer } from '../components/layout/PageContainer';
import { PageHeader } from '../components/layout/PageHeader';
import { Button } from '../components/ui/button';
import { cn } from '../lib/utils';
import { request as invoke } from '../utils/request';
import { AppConfig } from '../types/config';

const Monitor: React.FC = () => {
    const { t } = useTranslation();
    const [isLoggingEnabled, setIsLoggingEnabled] = useState(false);

    useEffect(() => {
        const loadLoggingState = async () => {
            try {
                const config = await invoke<AppConfig>('load_config');
                if (config?.proxy) {
                    setIsLoggingEnabled(config.proxy.enable_logging);
                }
            } catch (e) {
                console.error("Failed to load logging state", e);
            }
        };
        loadLoggingState();
    }, []);

    const toggleLogging = async () => {
        const newState = !isLoggingEnabled;
        try {
            const config = await invoke<AppConfig>('load_config');
            if (config?.proxy) {
                config.proxy.enable_logging = newState;
                await invoke('save_config', { config });
                await invoke('set_proxy_monitor_enabled', { enabled: newState });
                setIsLoggingEnabled(newState);
            }
        } catch (e) {
            console.error("Failed to toggle logging", e);
        }
    };

    return (
        <PageContainer className="overflow-hidden">
            <PageHeader
                title={t('nav.traffic_logs', 'Traffic Logs')}
                description={t('monitor.description', 'Real-time monitoring of API requests and traffic.')}
            >
                <Button
                    variant={isLoggingEnabled ? "destructive" : "secondary"}
                    size="sm"
                    onClick={toggleLogging}
                    className={cn("h-7 gap-2 text-xs font-medium", isLoggingEnabled && "animate-pulse")}
                >
                    <div className={cn("w-2 h-2 rounded-full", isLoggingEnabled ? "bg-white" : "bg-muted-foreground")} />
                    {isLoggingEnabled ? t('monitor.logging_status.active') : t('monitor.logging_status.paused')}
                </Button>
            </PageHeader>
            <div className="flex-1 bg-white/50 dark:bg-white/[0.02] rounded-codmate border border-codmate-border dark:border-codmate-border-dark shadow-codmate overflow-hidden mb-6">
                <ProxyMonitor
                    className="h-full rounded-none border-0 shadow-none"
                    isLoggingEnabled={isLoggingEnabled}
                    onToggleLogging={toggleLogging}
                />
            </div>
        </PageContainer>
    );
};

export default Monitor;