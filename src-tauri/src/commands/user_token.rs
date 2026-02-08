use crate::models::{Account, TokenData};
use crate::modules;
use crate::modules::user_token_db::{self, TokenIpBinding, UserToken};
use serde::{Deserialize, Serialize};
use tauri::Emitter;
use tauri::State;

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateTokenRequest {
    pub username: String,
    pub expires_type: String,
    pub description: Option<String>,
    pub max_ips: i32,
    pub curfew_start: Option<String>,
    pub curfew_end: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct UpdateTokenRequest {
    pub username: Option<String>,
    pub description: Option<String>,
    pub enabled: Option<bool>,
    pub max_ips: Option<i32>,
    pub curfew_start: Option<Option<String>>,
    pub curfew_end: Option<Option<String>>,
}

// 命令实现

/// 列出所有令牌
#[tauri::command]
pub async fn list_user_tokens() -> Result<Vec<UserToken>, String> {
    user_token_db::list_tokens()
}

/// 创建新令牌
#[tauri::command]
pub async fn create_user_token(request: CreateTokenRequest) -> Result<UserToken, String> {
    user_token_db::create_token(
        request.username,
        request.expires_type,
        request.description,
        request.max_ips,
        request.curfew_start,
        request.curfew_end,
    )
}

/// 更新令牌
#[tauri::command]
pub async fn update_user_token(id: String, request: UpdateTokenRequest) -> Result<(), String> {
    user_token_db::update_token(
        &id,
        request.username,
        request.description,
        request.enabled,
        request.max_ips,
        request.curfew_start,
        request.curfew_end,
    )
}

/// 删除令牌
#[tauri::command]
pub async fn delete_user_token(id: String) -> Result<(), String> {
    user_token_db::delete_token(&id)
}

/// 续期令牌
#[tauri::command]
pub async fn renew_user_token(id: String, expires_type: String) -> Result<(), String> {
    user_token_db::renew_token(&id, &expires_type)
}

/// 获取令牌 IP 绑定
#[tauri::command]
pub async fn get_token_ip_bindings(token_id: String) -> Result<Vec<TokenIpBinding>, String> {
    user_token_db::get_token_ips(&token_id)
}

#[derive(Debug, Serialize, Deserialize)]
pub struct UserTokenStats {
    pub total_tokens: usize,
    pub active_tokens: usize,
    pub total_users: usize,
    pub today_requests: i64,
}

/// 获取简单的统计信息
#[tauri::command]
pub async fn get_user_token_summary() -> Result<UserTokenStats, String> {
    let tokens = user_token_db::list_tokens()?;
    let active_tokens = tokens.iter().filter(|t| t.enabled).count();

    // 统计唯一用户
    let mut users = std::collections::HashSet::new();
    for t in &tokens {
        users.insert(t.username.clone());
    }

    // 这里简单返回一些数据，请求数最好从数据库聚合查询
    // 目前仅作为演示，请求数暂不精确统计今日的

    Ok(UserTokenStats {
        total_tokens: tokens.len(),
        active_tokens,
        total_users: users.len(),
        today_requests: 0, // TODO: Implement daily stats query
    })
}

#[derive(Debug, Serialize)]
pub struct LoginResponse {
    pub account: Account,
    pub id_token: String,
    pub access_token: String,
}

/// 登录 Topoo 用户 (仅获取 Token，不自动加入 Proxy 账号池)
#[tauri::command]
pub async fn login_topoo_user(app_handle: tauri::AppHandle) -> Result<LoginResponse, String> {
    modules::logger::log_info("开始 Topoo 用户登录流程...");

    let service = modules::account_service::AccountService::new(
        crate::modules::integration::SystemManager::Desktop(app_handle.clone()),
    );

    // 我们直接调用 oauth_server，因为 account_service 的方法会由副作用（保存账号）
    // 这里我们需要一个纯净的 Token 获取过程

    let handle = Some(app_handle.clone());
    let token_res = modules::oauth_server::start_oauth_flow(handle).await?;

    // 检查 ID Token
    let id_token = token_res
        .id_token
        .ok_or("未获取到 ID Token，请确认授权范围包含了 openid")?;

    // 获取用户信息 (如果需要补充)
    // 使用临时 ID
    let temp_account_id = uuid::Uuid::new_v4().to_string();
    let user_info =
        modules::oauth::get_user_info(&token_res.access_token, Some(&temp_account_id)).await?;

    // 构造返回对象
    let token_data = TokenData::new(
        token_res.access_token.clone(),
        token_res.refresh_token.unwrap_or_default(),
        token_res.expires_in,
        Some(user_info.email.clone()),
        None,
        None,
    );

    let account = Account {
        id: "temp_login".to_string(), // 临时 ID
        email: user_info.email.clone(),
        name: user_info.get_display_name(),
        token: token_data,
        device_profile: None,
        device_history: Vec::new(),
        quota: None,
        disabled: false,
        disabled_reason: None,
        disabled_at: None,
        proxy_disabled: false,
        proxy_disabled_reason: None,
        proxy_disabled_at: None,
        protected_models: std::collections::HashSet::new(),
        validation_blocked: false,
        validation_blocked_until: None,
        validation_blocked_reason: None,
        created_at: chrono::Utc::now().timestamp(),
        last_used: chrono::Utc::now().timestamp(),
        proxy_id: None,
        proxy_bound_at: None,
        custom_label: None,
    };

    modules::logger::log_info(&format!("Topoo 用户登录成功: {}", account.email));

    Ok(LoginResponse {
        account,
        id_token,
        access_token: token_res.access_token,
    })
}
