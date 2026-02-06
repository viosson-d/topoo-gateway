use crate::models::Account;
use crate::modules::{db, device, process};
use std::fs;

pub trait SystemIntegration: Send + Sync {
    /// 当切换账号时执行的系统层操作（如杀进程、写入文件、注入数据库）
    async fn on_account_switch(&self, account: &crate::models::Account) -> Result<(), String>;

    /// 更新系统托盘（如果适用）
    fn update_tray(&self);

    /// 发送系统通知
    fn show_notification(&self, title: &str, body: &str);
}

/// 桌面版实现：包含完整的进程控制和 UI 同步
pub struct DesktopIntegration {
    pub app_handle: tauri::AppHandle,
}

impl SystemIntegration for DesktopIntegration {
    async fn on_account_switch(&self, account: &crate::models::Account) -> Result<(), String> {
        crate::modules::logger::log_info(&format!(
            "[Antigravity] Executing system switch for: {}",
            account.email
        ));

        // 1. 获取存储路径
        let storage_path = device::get_storage_path()?;
        crate::modules::logger::log_info(&format!(
            "[Antigravity] Storage path: {:?}",
            storage_path
        ));

        // 2. 关闭外部进程
        if process::is_antigravity_running() {
            crate::modules::logger::log_info("[Antigravity] App is running, closing...");
            process::close_antigravity(20)?;
            crate::modules::logger::log_info("[Antigravity] App closed.");
        }

        // 3. 写入设备 Profile
        if let Some(ref profile) = account.device_profile {
            crate::modules::logger::log_info("[Antigravity] Writing device profile...");
            device::write_profile(&storage_path, profile)?;
            crate::modules::logger::log_info("[Antigravity] Device profile written.");
        }

        // 4. 数据库处理与 Token 注入
        crate::modules::logger::log_info("[Antigravity] Preparing database injection...");
        let db_path = db::get_db_path()?;
        crate::modules::logger::log_info(&format!("[Antigravity] DB path: {:?}", db_path));

        if db_path.exists() {
            let backup_path = db_path.with_extension("vscdb.backup");
            let _ = fs::copy(&db_path, &backup_path);
            crate::modules::logger::log_info("[Antigravity] Database backed up.");
        } else {
            crate::modules::logger::log_warn("[Antigravity] Database file not found!");
        }

        crate::modules::logger::log_info(
            "[Antigravity] Injecting token into Antigravity database keys...",
        );
        db::inject_token(
            &db_path,
            &account.token.access_token,
            &account.token.refresh_token,
            account.token.expiry_timestamp,
            &account.email,
        )?;
        crate::modules::logger::log_info("[Antigravity] Tokens injected successfully.");

        // 5. 重启外部进程
        crate::modules::logger::log_info("[Antigravity] Starting app...");
        process::start_antigravity()?;
        crate::modules::logger::log_info("[Antigravity] App started.");

        // 6. 更新托盘
        crate::modules::logger::log_info("[Antigravity] Updating tray...");
        let _ = crate::modules::tray::update_tray_menus(&self.app_handle);

        Ok(())
    }

    fn update_tray(&self) {
        let _ = crate::modules::tray::update_tray_menus(&self.app_handle);
    }

    fn show_notification(&self, title: &str, body: &str) {
        // 使用 tauri-plugin-dialog 或原生通知（此处简化）
        crate::modules::logger::log_info(&format!("[Notification] {}: {}", title, body));
    }
}

/// Headless/Docker 实现：仅执行数据层操作，忽略 UI 和进程控制
pub struct HeadlessIntegration;

impl SystemIntegration for HeadlessIntegration {
    async fn on_account_switch(&self, account: &crate::models::Account) -> Result<(), String> {
        crate::modules::logger::log_info(&format!(
            "[Headless] Account switched in memory: {}",
            account.email
        ));
        // Docker 模式下通常不直接控制宿主机的 Antigravity 进程
        // 如果需要同步配置到某个 volume，可以在此处添加逻辑
        Ok(())
    }

    fn update_tray(&self) {
        // No-op
    }

    fn show_notification(&self, title: &str, body: &str) {
        crate::modules::logger::log_info(&format!("[Log Notification] {}: {}", title, body));
    }
}
/// 系统集成管理器：替代 Arc<dyn SystemIntegration> 以解决 async trait 的 dyn 兼容性问题
#[derive(Clone)]
pub enum SystemManager {
    Desktop(tauri::AppHandle),
    Headless,
}

impl SystemManager {
    pub async fn on_account_switch(&self, account: &Account) -> Result<(), String> {
        match self {
            SystemManager::Desktop(handle) => {
                let integration = DesktopIntegration {
                    app_handle: handle.clone(),
                };
                integration.on_account_switch(account).await
            }
            SystemManager::Headless => {
                let integration = HeadlessIntegration;
                integration.on_account_switch(account).await
            }
        }
    }

    pub fn update_tray(&self) {
        if let SystemManager::Desktop(handle) = self {
            let integration = DesktopIntegration {
                app_handle: handle.clone(),
            };
            integration.update_tray();
        }
    }

    pub fn show_notification(&self, title: &str, body: &str) {
        match self {
            SystemManager::Desktop(handle) => {
                let integration = DesktopIntegration {
                    app_handle: handle.clone(),
                };
                integration.show_notification(title, body);
            }
            SystemManager::Headless => {
                let integration = HeadlessIntegration;
                integration.show_notification(title, body);
            }
        }
    }
}

impl SystemIntegration for SystemManager {
    async fn on_account_switch(&self, account: &crate::models::Account) -> Result<(), String> {
        match self {
            SystemManager::Desktop(handle) => {
                let integration = DesktopIntegration {
                    app_handle: handle.clone(),
                };
                integration.on_account_switch(account).await
            }
            SystemManager::Headless => {
                let integration = HeadlessIntegration;
                integration.on_account_switch(account).await
            }
        }
    }

    fn update_tray(&self) {
        match self {
            SystemManager::Desktop(handle) => {
                let integration = DesktopIntegration {
                    app_handle: handle.clone(),
                };
                integration.update_tray();
            }
            SystemManager::Headless => {
                let integration = HeadlessIntegration;
                integration.update_tray();
            }
        }
    }

    fn show_notification(&self, title: &str, body: &str) {
        match self {
            SystemManager::Desktop(handle) => {
                let integration = DesktopIntegration {
                    app_handle: handle.clone(),
                };
                integration.show_notification(title, body);
            }
            SystemManager::Headless => {
                let integration = HeadlessIntegration;
                integration.show_notification(title, body);
            }
        }
    }
}
