use crate::utils::protobuf;
use base64::{engine::general_purpose, Engine as _};
use rusqlite::Connection;
use std::path::PathBuf;

fn get_antigravity_path() -> Option<PathBuf> {
    if let Ok(config) = crate::modules::config::load_app_config() {
        if let Some(path_str) = config.antigravity_executable {
            let path = PathBuf::from(path_str);
            if path.exists() {
                return Some(path);
            }
        }
    }
    crate::modules::process::get_antigravity_executable_path()
}

/// Get Antigravity database path (cross-platform)
pub fn get_db_path() -> Result<PathBuf, String> {
    // Prefer path specified by --user-data-dir argument
    if let Some(user_data_dir) = crate::modules::process::get_user_data_dir_from_process() {
        let custom_db_path = user_data_dir
            .join("User")
            .join("globalStorage")
            .join("state.vscdb");
        if custom_db_path.exists() {
            return Ok(custom_db_path);
        }
    }

    // Check if in portable mode
    if let Some(antigravity_path) = get_antigravity_path() {
        if let Some(parent_dir) = antigravity_path.parent() {
            let portable_db_path = PathBuf::from(parent_dir)
                .join("data")
                .join("user-data")
                .join("User")
                .join("globalStorage")
                .join("state.vscdb");

            if portable_db_path.exists() {
                return Ok(portable_db_path);
            }
        }
    }

    // Standard mode: Search for existing DB to avoid writing to wrong location
    // The application might be named "Topoo Gateway" but still use "Antigravity" for data storage (as seen in Reference)
    let target_app = crate::modules::config::load_app_config()
        .map(|c| c.target_app_name)
        .unwrap_or_else(|_| "Topoo Gateway".to_string());

    let home = dirs::home_dir().ok_or("Failed to get home directory")?;

    // Candidate paths to check (Priority: Configured Name -> Hardcoded Legacy Name)
    let candidates = vec![
        #[cfg(target_os = "macos")]
        home.join(format!(
            "Library/Application Support/{}/User/globalStorage/state.vscdb",
            target_app
        )),
        #[cfg(target_os = "macos")]
        home.join("Library/Application Support/Antigravity/User/globalStorage/state.vscdb"),
        #[cfg(target_os = "windows")]
        PathBuf::from(std::env::var("APPDATA").unwrap_or_default())
            .join(format!("{}\\User\\globalStorage\\state.vscdb", target_app)),
        #[cfg(target_os = "windows")]
        PathBuf::from(std::env::var("APPDATA").unwrap_or_default())
            .join("Antigravity\\User\\globalStorage\\state.vscdb"),
        #[cfg(target_os = "linux")]
        home.join(format!(
            ".config/{}/User/globalStorage/state.vscdb",
            target_app
        )),
        #[cfg(target_os = "linux")]
        home.join(".config/Antigravity/User/globalStorage/state.vscdb"),
    ];

    for path in candidates {
        if path.exists() {
            crate::modules::logger::log_info(&format!("Found existing database at: {:?}", path));
            return Ok(path);
        }
    }

    // Fallback: If no existing DB found, default to Configured Name path (fresh install scenario)
    #[cfg(target_os = "macos")]
    {
        Ok(home.join(format!(
            "Library/Application Support/{}/User/globalStorage/state.vscdb",
            target_app
        )))
    }

    #[cfg(target_os = "windows")]
    {
        let appdata = std::env::var("APPDATA")
            .map_err(|_| "Failed to get APPDATA environment variable".to_string())?;
        Ok(
            PathBuf::from(appdata)
                .join(format!("{}\\User\\globalStorage\\state.vscdb", target_app)),
        )
    }

    #[cfg(target_os = "linux")]
    {
        Ok(home.join(format!(
            ".config/{}/User/globalStorage/state.vscdb",
            target_app
        )))
    }
}

/// Inject Token and Email into database
pub fn inject_token(
    db_path: &std::path::PathBuf,
    access_token: &str,
    refresh_token: &str,
    expiry: i64,
    email: &str,
) -> Result<String, String> {
    crate::modules::logger::log_info(&format!(
        "🔧 [DB Inject] Starting injection for email: {}",
        email
    ));

    // 1. Open database
    let conn = Connection::open(db_path).map_err(|e| format!("Failed to open database: {}", e))?;

    // [OPTIMIZATION] Set busy timeout to avoid immediate failure when DB is locked by IDE
    let _ = conn.execute("PRAGMA busy_timeout = 5000", []);

    // 2. Read current data from Legacy key
    let current_data: String = conn
        .query_row(
            "SELECT value FROM ItemTable WHERE key = ?",
            ["jetskiStateSync.agentManagerInitState"],
            |row| row.get(0),
        )
        .map_err(|e| format!("Failed to read data: {}", e))?;

    crate::modules::logger::log_info(&format!(
        "📖 [DB Inject] Read current data, length: {} bytes",
        current_data.len()
    ));

    // 3. Base64 decode
    let blob = general_purpose::STANDARD
        .decode(&current_data)
        .map_err(|e| format!("Base64 decoding failed: {}", e))?;

    crate::modules::logger::log_info(&format!(
        "🔓 [DB Inject] Decoded blob, length: {} bytes",
        blob.len()
    ));

    // 4. Remove old Identity and Token fields
    // Field 1: UserID
    // Field 2: Email
    // Field 6: OAuthTokenInfo
    let mut clean_data = protobuf::remove_field(&blob, 1)?;
    clean_data = protobuf::remove_field(&clean_data, 2)?;
    clean_data = protobuf::remove_field(&clean_data, 6)?;

    crate::modules::logger::log_info(&format!(
        "🧹 [DB Inject] Cleaned old fields, new length: {} bytes",
        clean_data.len()
    ));

    // 5. Create new fields
    let new_email_field = protobuf::create_email_field(email);
    let new_oauth_field = protobuf::create_oauth_field(access_token, refresh_token, expiry);

    crate::modules::logger::log_info(&format!(
        "✨ [DB Inject] Created new fields - email: {} bytes, oauth: {} bytes",
        new_email_field.len(),
        new_oauth_field.len()
    ));

    // 6. Merge data
    // We intentionally do NOT re-inject Field 1 (UserID) to force the client
    // to re-authenticate the session with the new token.
    let final_data = [clean_data, new_email_field, new_oauth_field].concat();
    let final_b64 = general_purpose::STANDARD.encode(&final_data);

    crate::modules::logger::log_info(&format!(
        "🔀 [DB Inject] Merged data, final length: {} bytes (base64: {} bytes)",
        final_data.len(),
        final_b64.len()
    ));

    // 7. Write to database
    let rows_affected = conn
        .execute(
            "UPDATE ItemTable SET value = ? WHERE key = ?",
            [&final_b64, "jetskiStateSync.agentManagerInitState"],
        )
        .map_err(|e| format!("Failed to write data: {}", e))?;

    crate::modules::logger::log_info(&format!(
        "💾 [DB Inject] Database UPDATE executed, rows affected: {}",
        rows_affected
    ));

    if rows_affected == 0 {
        return Err("Database UPDATE affected 0 rows! Key might not exist.".to_string());
    }

    // [NEW] Verify the write by reading back
    let verify_data: String = conn
        .query_row(
            "SELECT value FROM ItemTable WHERE key = ?",
            ["jetskiStateSync.agentManagerInitState"],
            |row| row.get(0),
        )
        .map_err(|e| format!("Failed to verify write: {}", e))?;

    if verify_data != final_b64 {
        crate::modules::logger::log_error(
            "❌ [DB Inject] VERIFICATION FAILED! Data was not written correctly!",
        );
        return Err("Database write verification failed!".to_string());
    }

    crate::modules::logger::log_info(
        "✅ [DB Inject] Verification passed! Data written successfully.",
    );

    // [NEW] 8. Inject into Unified Storage Key (antigravityUnifiedStateSync.oauthToken)
    // This is required for newer versions of the IDE (Topoo Gateway)
    let unified_token_blob =
        protobuf::create_unified_token_message(access_token, refresh_token, expiry);
    let unified_token_b64 = general_purpose::STANDARD.encode(&unified_token_blob);

    let unified_key = "antigravityUnifiedStateSync.oauthToken";

    crate::modules::logger::log_info(&format!(
        "✨ [DB Inject] Injecting into Unified Key: {}",
        unified_key
    ));

    conn.execute(
        "INSERT OR REPLACE INTO ItemTable (key, value) VALUES (?, ?)",
        [unified_key, &unified_token_b64],
    )
    .map_err(|e| format!("Failed to write Unified Token: {}", e))?;

    // 9. Inject Onboarding flag
    let onboarding_key = "antigravityOnboarding";
    conn.execute(
        "INSERT OR REPLACE INTO ItemTable (key, value) VALUES (?, ?)",
        [onboarding_key, "true"],
    )
    .map_err(|e| format!("Failed to write Onboarding flag: {}", e))?;

    Ok(format!(
        "Token injection successful (Legacy + Unified)!\nDatabase: {:?}\nEmail: {}",
        db_path, email
    ))
}
