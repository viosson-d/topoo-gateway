import { Link, useLocation } from 'react-router-dom';
import { Sun, Moon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useConfigStore } from '../../stores/useConfigStore';

// Detect if running on Linux platform
// const isLinux = navigator.userAgent.toLowerCase().includes('linux');

function Navbar() {
    const location = useLocation();
    const { t, i18n } = useTranslation();
    const { config, saveConfig } = useConfigStore();

    const navItems = [
        { path: '/', label: t('nav.dashboard') },
        { path: '/accounts', label: t('nav.accounts') },
        { path: '/api-proxy', label: t('nav.proxy') },
        { path: '/monitor', label: t('nav.call_records') },
        { path: '/token-stats', label: t('nav.token_stats', 'Token 统计') },
        { path: '/settings', label: t('nav.settings') },
    ];

    const isActive = (path: string) => {
        if (path === '/') {
            return location.pathname === '/';
        }
        return location.pathname.startsWith(path);
    };

    const toggleTheme = async (_event: React.MouseEvent<HTMLButtonElement>) => {
        if (!config) return;

        const newTheme = config.theme === 'light' ? 'dark' : 'light';

        // DISABLING View Transition API to avoid UI locking issues on macOS/WebKit
        await saveConfig({
            ...config,
            theme: newTheme,
            language: config.language
        });
    };

    const toggleLanguage = async () => {
        if (!config) return;
        const langs = ['zh', 'zh-TW', 'en', 'ja', 'tr', 'vi', 'pt', 'ru'] as const;
        const currentIndex = langs.indexOf(config.language as any);
        const nextLang = langs[(currentIndex + 1) % langs.length];

        await saveConfig({
            ...config,
            language: nextLang,
            theme: config.theme
        });
        i18n.changeLanguage(nextLang);
    };

    return (
        <nav
            style={{ position: 'sticky', top: 0, zIndex: 50 }}
            className="pt-9 transition-all duration-200 bg-[#FAFBFC] dark:bg-base-300"
        >

            <div className="max-w-7xl mx-auto px-8 relative" style={{ zIndex: 10 }}>
                <div className="flex items-center justify-between h-16">
                    {/* Logo - 左侧 */}
                    <div className="flex items-center">
                        <Link to="/" className="text-xl font-medium text-gray-900 dark:text-base-content flex items-center gap-2">
                            Topoo Gateway
                        </Link>
                    </div>

                    {/* 药丸形状的导航标签 - 居中 */}
                    <div className="flex items-center gap-1 bg-gray-100 dark:bg-base-200 rounded-full p-1">
                        {navItems.map((item) => (
                            <Link
                                key={item.path}
                                to={item.path}
                                className={`px-6 py-2 rounded-full text-sm font-medium transition-all ${isActive(item.path)
                                    ? 'bg-gray-900 text-white shadow-sm dark:bg-white dark:text-gray-900'
                                    : 'text-gray-700 hover:text-gray-900 hover:bg-gray-200 dark:text-gray-400 dark:hover:text-base-content dark:hover:bg-base-100'
                                    }`}
                            >
                                {item.label}
                            </Link>
                        ))}
                    </div>

                    {/* 右侧快捷设置按钮 */}
                    <div className="flex items-center gap-2">
                        {/* 主题切换按钮 */}
                        <button
                            onClick={toggleTheme}
                            className="w-10 h-10 rounded-full bg-gray-100 dark:bg-base-200 hover:bg-gray-200 dark:hover:bg-base-100 flex items-center justify-center transition-colors"
                            title={config?.theme === 'light' ? t('nav.theme_to_dark') : t('nav.theme_to_light')}
                        >
                            {config?.theme === 'light' ? (
                                <Moon className="w-5 h-5 text-gray-700 dark:text-gray-300" />
                            ) : (
                                <Sun className="w-5 h-5 text-gray-700 dark:text-gray-300" />
                            )}
                        </button>

                        {/* 语言切换按钮 */}
                        <button
                            onClick={toggleLanguage}
                            className="w-10 h-10 rounded-full bg-gray-100 dark:bg-base-200 hover:bg-gray-200 dark:hover:bg-base-100 flex items-center justify-center transition-colors"
                            title={t('nav.switch_to_' + (config?.language === 'zh' ? 'traditional_chinese' : config?.language === 'zh-TW' ? 'english' : config?.language === 'en' ? 'japanese' : config?.language === 'ja' ? 'turkish' : config?.language === 'tr' ? 'vietnamese' : config?.language === 'vi' ? 'portuguese' : config?.language === 'pt' ? 'russian' : 'chinese'))}
                        >
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                {t('nav.switch_to_' + (config?.language === 'zh' ? 'traditional_chinese_short' : config?.language === 'zh-TW' ? 'english_short' : config?.language === 'en' ? 'japanese_short' : config?.language === 'ja' ? 'turkish_short' : config?.language === 'tr' ? 'vietnamese_short' : config?.language === 'vi' ? 'portuguese_short' : config?.language === 'pt' ? 'russian_short' : 'chinese_short'))}
                            </span>
                        </button>
                    </div>
                </div>
            </div>
        </nav>
    );
}

export default Navbar;
