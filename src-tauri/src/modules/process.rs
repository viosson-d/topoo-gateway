use std::process::Command;
use std::thread;
use std::time::Duration;
use sysinfo::System;

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

/// Get normalized path of the current running executable
fn get_current_exe_path() -> Option<std::path::PathBuf> {
    std::env::current_exe()
        .ok()
        .and_then(|p| p.canonicalize().ok())
}

/// Check if Antigravity is running
pub fn is_antigravity_running() -> bool {
    let target_app = crate::modules::config::load_app_config()
        .map(|c| c.target_app_name)
        .unwrap_or_else(|_| "Antigravity".to_string());
    let target_app_lower = target_app.to_lowercase();

    let mut system = System::new();
    system.refresh_processes(sysinfo::ProcessesToUpdate::All);

    let current_exe = get_current_exe_path();
    let current_pid = std::process::id();

    // Recognition ref 1: Load manual config path (moved outside loop for performance)
    let manual_path = crate::modules::config::load_app_config()
        .ok()
        .and_then(|c| c.antigravity_executable)
        .and_then(|p| std::path::PathBuf::from(p).canonicalize().ok());

    for (pid, process) in system.processes() {
        let pid_u32 = pid.as_u32();
        if pid_u32 == current_pid {
            continue;
        }

        let name = process.name().to_string_lossy().to_lowercase();
        let exe_path = process
            .exe()
            .and_then(|p| p.to_str())
            .unwrap_or("")
            .to_lowercase();

        // Exclude own path (handles case where manager is mistaken for Antigravity on Linux)
        if let (Some(ref my_path), Some(p_exe)) = (&current_exe, process.exe()) {
            if let Ok(p_path) = p_exe.canonicalize() {
                if my_path == &p_path {
                    continue;
                }
            }
        }

        // Recognition ref 2: Priority check for manual path match
        if let (Some(ref m_path), Some(p_exe)) = (&manual_path, process.exe()) {
            if let Ok(p_path) = p_exe.canonicalize() {
                // macOS: Check if within the same .app bundle
                #[cfg(target_os = "macos")]
                {
                    let m_path_str = m_path.to_string_lossy();
                    let p_path_str = p_path.to_string_lossy();
                    if let (Some(m_idx), Some(p_idx)) =
                        (m_path_str.find(".app"), p_path_str.find(".app"))
                    {
                        if m_path_str[..m_idx + 4] == p_path_str[..p_idx + 4] {
                            // Even if path matches, must confirm via name and args that it's not a Helper
                            let args = process.cmd();
                            let is_helper_by_args = args
                                .iter()
                                .any(|arg| arg.to_string_lossy().contains("--type="));
                            let is_helper_by_name = name.contains("helper")
                                || name.contains("plugin")
                                || name.contains("renderer")
                                || name.contains("gpu")
                                || name.contains("crashpad")
                                || name.contains("utility")
                                || name.contains("audio")
                                || name.contains("sandbox");
                            if !is_helper_by_args && !is_helper_by_name {
                                return true;
                            }
                        }
                    }
                }

                #[cfg(not(target_os = "macos"))]
                if m_path == &p_path {
                    return true;
                }
            }
        }

        // Common helper process exclusion logic
        let args = process.cmd();
        let args_str = args
            .iter()
            .map(|arg| arg.to_string_lossy().to_lowercase())
            .collect::<Vec<String>>()
            .join(" ");

        let is_helper = args_str.contains("--type=")
            || name.contains("helper")
            || name.contains("plugin")
            || name.contains("renderer")
            || name.contains("gpu")
            || name.contains("crashpad")
            || name.contains("utility")
            || name.contains("audio")
            || name.contains("sandbox")
            || exe_path.contains("crashpad");

        #[cfg(target_os = "macos")]
        {
            let app_match = format!("{}.app", target_app_lower);
            if exe_path.contains(&app_match) && !is_helper {
                return true;
            }
        }

        #[cfg(target_os = "windows")]
        {
            let exe_match = format!("{}.exe", target_app_lower);
            if name == exe_match && !is_helper {
                return true;
            }
        }

        #[cfg(target_os = "linux")]
        {
            if (name.contains(&target_app_lower)
                || exe_path.contains(&format!("/{}", target_app_lower)))
                && !name.contains("tools")
                && !is_helper
            {
                return true;
            }
        }
    }

    false
}

#[cfg(target_os = "linux")]
/// Get PID set of current process and all direct relatives (ancestors + descendants)
fn get_self_family_pids(system: &sysinfo::System) -> std::collections::HashSet<u32> {
    let current_pid = std::process::id();
    let mut family_pids = std::collections::HashSet::new();
    family_pids.insert(current_pid);

    // 1. Look up all ancestors (Ancestors) - prevent killing the launcher
    let mut next_pid = current_pid;
    // Prevent infinite loop, max depth 10
    for _ in 0..10 {
        let pid_val = sysinfo::Pid::from_u32(next_pid);
        if let Some(process) = system.process(pid_val) {
            if let Some(parent) = process.parent() {
                let parent_id = parent.as_u32();
                // Avoid cycles or duplicates
                if !family_pids.insert(parent_id) {
                    break;
                }
                next_pid = parent_id;
            } else {
                break;
            }
        } else {
            break;
        }
    }

    // 2. Look down all descendants (Descendants)
    // Build parent-child relationship map (Parent -> Children)
    let mut adj: std::collections::HashMap<u32, Vec<u32>> = std::collections::HashMap::new();
    for (pid, process) in system.processes() {
        if let Some(parent) = process.parent() {
            adj.entry(parent.as_u32()).or_default().push(pid.as_u32());
        }
    }

    // BFS traversal to find all descendants
    let mut queue = std::collections::VecDeque::new();
    queue.push_back(current_pid);

    while let Some(pid) = queue.pop_front() {
        if let Some(children) = adj.get(&pid) {
            for &child in children {
                if family_pids.insert(child) {
                    queue.push_back(child);
                }
            }
        }
    }

    family_pids
}

/// Get PIDs of all Antigravity processes (including main and helper processes)
fn get_antigravity_pids() -> Vec<u32> {
    let target_app = crate::modules::config::load_app_config()
        .map(|c| c.target_app_name)
        .unwrap_or_else(|_| "Antigravity".to_string());
    let target_app_lower = target_app.to_lowercase();

    let mut system = System::new();
    system.refresh_processes(sysinfo::ProcessesToUpdate::All);

    // Linux: Enable family process tree exclusion
    #[cfg(target_os = "linux")]
    let family_pids = get_self_family_pids(&system);

    let mut pids = Vec::new();
    let current_pid = std::process::id();
    let current_exe = get_current_exe_path();

    // Load manual config path as auxiliary reference
    let manual_path = crate::modules::config::load_app_config()
        .ok()
        .and_then(|c| c.antigravity_executable)
        .and_then(|p| std::path::PathBuf::from(p).canonicalize().ok());

    for (pid, process) in system.processes() {
        let pid_u32 = pid.as_u32();

        // Exclude own PID
        if pid_u32 == current_pid {
            continue;
        }

        // Exclude own executable path (hardened against broad name matching)
        if let (Some(ref my_path), Some(p_exe)) = (&current_exe, process.exe()) {
            if let Ok(p_path) = p_exe.canonicalize() {
                if my_path == &p_path {
                    continue;
                }
            }
        }

        let name = process.name().to_string_lossy().to_lowercase();

        #[cfg(target_os = "linux")]
        {
            // 1. Exclude family processes (self, children, parents)
            if family_pids.contains(&pid_u32) {
                continue;
            }
            // 2. Extra protection: match "tools" likely manager if not a child
            if name.contains("tools") {
                continue;
            }
        }

        // Recognition ref 3: Check manual config path match
        if let (Some(ref m_path), Some(p_exe)) = (&manual_path, process.exe()) {
            if let Ok(p_path) = p_exe.canonicalize() {
                #[cfg(target_os = "macos")]
                {
                    let m_path_str = m_path.to_string_lossy();
                    let p_path_str = p_path.to_string_lossy();
                    if let (Some(m_idx), Some(p_idx)) =
                        (m_path_str.find(".app"), p_path_str.find(".app"))
                    {
                        if m_path_str[..m_idx + 4] == p_path_str[..p_idx + 4] {
                            let args = process.cmd();
                            let is_helper_by_args = args
                                .iter()
                                .any(|arg| arg.to_string_lossy().contains("--type="));
                            let is_helper_by_name = name.contains("helper")
                                || name.contains("plugin")
                                || name.contains("renderer")
                                || name.contains("gpu")
                                || name.contains("crashpad")
                                || name.contains("utility")
                                || name.contains("audio")
                                || name.contains("sandbox");
                            if !is_helper_by_args && !is_helper_by_name {
                                pids.push(pid_u32);
                                continue;
                            }
                        }
                    }
                }

                #[cfg(not(target_os = "macos"))]
                if m_path == &p_path {
                    pids.push(pid_u32);
                    continue;
                }
            }
        }

        // Get executable path
        let exe_path = process
            .exe()
            .and_then(|p| p.to_str())
            .unwrap_or("")
            .to_lowercase();

        // Common helper process exclusion logic
        let args = process.cmd();
        let args_str = args
            .iter()
            .map(|arg| arg.to_string_lossy().to_lowercase())
            .collect::<Vec<String>>()
            .join(" ");

        let is_helper = args_str.contains("--type=")
            || name.contains("helper")
            || name.contains("plugin")
            || name.contains("renderer")
            || name.contains("gpu")
            || name.contains("crashpad")
            || name.contains("utility")
            || name.contains("audio")
            || name.contains("sandbox")
            || exe_path.contains("crashpad");

        #[cfg(target_os = "macos")]
        {
            let app_match = format!("{}.app", target_app_lower);
            if exe_path.contains(&app_match) && !is_helper {
                pids.push(pid_u32);
            }
        }

        #[cfg(target_os = "windows")]
        {
            let exe_match = format!("{}.exe", target_app_lower);
            if name == exe_match && !is_helper {
                pids.push(pid_u32);
            }
        }

        #[cfg(target_os = "linux")]
        {
            if (name == target_app_lower || exe_path.contains(&format!("/{}", target_app_lower)))
                && !name.contains("tools")
                && !is_helper
            {
                pids.push(pid_u32);
            }
        }
    }

    if !pids.is_empty() {
        crate::modules::logger::log_info(&format!(
            "Found {} {} processes: {:?}",
            pids.len(),
            target_app,
            pids
        ));
    }

    pids
}

/// Close Antigravity processes
pub fn close_antigravity(#[allow(unused_variables)] timeout_secs: u64) -> Result<(), String> {
    let target_app = crate::modules::config::load_app_config()
        .map(|c| c.target_app_name)
        .unwrap_or_else(|_| "Antigravity".to_string());
    crate::modules::logger::log_info(&format!("Closing {}...", target_app));

    #[cfg(target_os = "windows")]
    {
        // Windows: Precise kill by PID to support multiple versions or custom filenames
        let pids = get_antigravity_pids();
        if !pids.is_empty() {
            crate::modules::logger::log_info(&format!(
                "Precisely closing {} identified processes on Windows...",
                pids.len()
            ));
            for pid in pids {
                let _ = Command::new("taskkill")
                    .args(["/F", "/PID", &pid.to_string()])
                    .creation_flags(0x08000000) // CREATE_NO_WINDOW
                    .output();
            }
            // Give some time for system to clean up PIDs
            thread::sleep(Duration::from_millis(200));
        }
    }

    #[cfg(target_os = "macos")]
    {
        // macOS: Optimize closing strategy to avoid "Window terminated unexpectedly" popups
        // Strategy: SEND SIGTERM to main process only, let it coordinate closing children

        let pids = get_antigravity_pids();
        if !pids.is_empty() {
            // 1. Identify main process (PID)
            let mut system = System::new();
            system.refresh_processes(sysinfo::ProcessesToUpdate::All);

            let mut main_pid = None;

            // Load manual configuration path as highest priority reference
            let manual_path = crate::modules::config::load_app_config()
                .ok()
                .and_then(|c| c.antigravity_executable)
                .and_then(|p| std::path::PathBuf::from(p).canonicalize().ok());

            crate::modules::logger::log_info("Analyzing process list to identify main process:");
            for pid_u32 in &pids {
                let pid = sysinfo::Pid::from_u32(*pid_u32);
                if let Some(process) = system.process(pid) {
                    let name = process.name().to_string_lossy();
                    let args = process.cmd();
                    let args_str = args
                        .iter()
                        .map(|arg| arg.to_string_lossy().into_owned())
                        .collect::<Vec<String>>()
                        .join(" ");

                    crate::modules::logger::log_info(&format!(
                        " - PID: {} | Name: {} | Args: {}",
                        pid_u32, name, args_str
                    ));

                    // 1. Priority to manual path matching
                    if let (Some(ref m_path), Some(p_exe)) = (&manual_path, process.exe()) {
                        if let Ok(p_path) = p_exe.canonicalize() {
                            let m_path_str = m_path.to_string_lossy();
                            let p_path_str = p_path.to_string_lossy();
                            if let (Some(m_idx), Some(p_idx)) =
                                (m_path_str.find(".app"), p_path_str.find(".app"))
                            {
                                if m_path_str[..m_idx + 4] == p_path_str[..p_idx + 4] {
                                    // Deep validation: even if path matches, must exclude Helper keywords and arguments
                                    let is_helper_by_args = args_str.contains("--type=");
                                    let is_helper_by_name = name.to_lowercase().contains("helper")
                                        || name.to_lowercase().contains("plugin")
                                        || name.to_lowercase().contains("renderer")
                                        || name.to_lowercase().contains("gpu")
                                        || name.to_lowercase().contains("crashpad")
                                        || name.to_lowercase().contains("utility")
                                        || name.to_lowercase().contains("audio")
                                        || name.to_lowercase().contains("sandbox")
                                        || name.to_lowercase().contains("language_server");

                                    if !is_helper_by_args && !is_helper_by_name {
                                        main_pid = Some(*pid_u32);
                                        crate::modules::logger::log_info(&format!(
                                            "   => Identified as main process (manual path match)"
                                        ));
                                        break;
                                    }
                                }
                            }
                        }
                    }

                    // 2. Feature analysis matching (fallback)
                    let is_helper_by_name = name.to_lowercase().contains("helper")
                        || name.to_lowercase().contains("crashpad")
                        || name.to_lowercase().contains("utility")
                        || name.to_lowercase().contains("audio")
                        || name.to_lowercase().contains("sandbox")
                        || name.to_lowercase().contains("language_server")
                        || name.to_lowercase().contains("plugin")
                        || name.to_lowercase().contains("renderer");

                    let is_helper_by_args = args_str.contains("--type=");

                    if !is_helper_by_name && !is_helper_by_args {
                        if main_pid.is_none() {
                            main_pid = Some(*pid_u32);
                            crate::modules::logger::log_info(&format!(
                                "   => Identified as main process (Name/Args analysis)"
                            ));
                        }
                    } else {
                        crate::modules::logger::log_info(&format!(
                            "   => Identified as helper process (Helper/Args)"
                        ));
                    }
                }
            }

            // Phase 1: Graceful exit (SIGTERM)
            if let Some(pid) = main_pid {
                crate::modules::logger::log_info(&format!(
                    "Sending SIGTERM to main process PID: {}",
                    pid
                ));
                let output = Command::new("kill")
                    .args(["-15", &pid.to_string()])
                    .output();

                if let Ok(result) = output {
                    if !result.status.success() {
                        let error = String::from_utf8_lossy(&result.stderr);
                        crate::modules::logger::log_warn(&format!(
                            "Main process SIGTERM failed: {}",
                            error
                        ));
                    }
                }
            } else {
                crate::modules::logger::log_warn(
                    "No clear main process identified, attempting SIGTERM for all processes (may cause popups)",
                );
                for pid in &pids {
                    let _ = Command::new("kill")
                        .args(["-15", &pid.to_string()])
                        .output();
                }
            }

            // Wait for graceful exit (max 70% of timeout_secs)
            let graceful_timeout = (timeout_secs * 7) / 10;
            let start = std::time::Instant::now();
            while start.elapsed() < Duration::from_secs(graceful_timeout) {
                if !is_antigravity_running() {
                    crate::modules::logger::log_info(&format!(
                        "All {} processes gracefully closed",
                        target_app
                    ));
                    return Ok(());
                }
                thread::sleep(Duration::from_millis(500));
            }

            // Phase 2: Force kill (SIGKILL) - targeting all remaining processes (Helpers)
            if is_antigravity_running() {
                let remaining_pids = get_antigravity_pids();
                if !remaining_pids.is_empty() {
                    crate::modules::logger::log_warn(&format!(
                        "Graceful exit timeout, force killing {} remaining processes (SIGKILL)",
                        remaining_pids.len()
                    ));
                    for pid in &remaining_pids {
                        let output = Command::new("kill").args(["-9", &pid.to_string()]).output();

                        if let Ok(result) = output {
                            if !result.status.success() {
                                let error = String::from_utf8_lossy(&result.stderr);
                                if !error.contains("No such process") {
                                    crate::modules::logger::log_error(&format!(
                                        "SIGKILL process {} failed: {}",
                                        pid, error
                                    ));
                                }
                            }
                        }
                    }
                    thread::sleep(Duration::from_secs(1));
                }

                // Final check
                if !is_antigravity_running() {
                    crate::modules::logger::log_info("All processes exited after forced cleanup");
                    return Ok(());
                }
            } else {
                crate::modules::logger::log_info("All processes exited after SIGTERM");
                return Ok(());
            }
        } else {
            crate::modules::logger::log_info(&format!(
                "{} not running, no need to close",
                target_app
            ));
            return Ok(());
        }
    }

    #[cfg(target_os = "linux")]
    {
        // Linux logic (similar to macOS SIGTERM strategy)
        let pids = get_antigravity_pids();
        if !pids.is_empty() {
            // ... (SIGTERM/SIGKILL logic for Linux)
            for pid in &pids {
                let _ = Command::new("kill")
                    .args(["-15", &pid.to_string()])
                    .output();
            }
            thread::sleep(Duration::from_secs(1));
            if is_antigravity_running() {
                for pid in get_antigravity_pids() {
                    let _ = Command::new("kill").args(["-9", &pid.to_string()]).output();
                }
            }
        }
    }

    // Final check
    if is_antigravity_running() {
        return Err(format!(
            "Unable to close {} process, please close manually and retry",
            target_app
        ));
    }

    crate::modules::logger::log_info(&format!("{} closed successfully", target_app));
    Ok(())
}

/// Start Antigravity
pub fn start_antigravity() -> Result<(), String> {
    let target_app = crate::modules::config::load_app_config()
        .map(|c| c.target_app_name)
        .unwrap_or_else(|_| "Antigravity".to_string());
    crate::modules::logger::log_info(&format!("Starting {}...", target_app));

    let config = crate::modules::config::load_app_config().ok();
    let manual_path = config
        .as_ref()
        .and_then(|c| c.antigravity_executable.clone());
    let args = config.and_then(|c| c.antigravity_args.clone());

    if let Some(mut path_str) = manual_path {
        let mut path = std::path::PathBuf::from(&path_str);

        #[cfg(target_os = "macos")]
        {
            if let Some(app_idx) = path_str.find(".app") {
                let corrected_app = &path_str[..app_idx + 4];
                if corrected_app != path_str {
                    crate::modules::logger::log_info(&format!(
                        "Detected macOS path inside .app bundle, auto-correcting to: {}",
                        corrected_app
                    ));
                    path_str = corrected_app.to_string();
                    path = std::path::PathBuf::from(&path_str);
                }
            }
        }

        if path.exists() {
            crate::modules::logger::log_info(&format!(
                "Starting with manual configuration path: {}",
                path_str
            ));

            #[cfg(target_os = "macos")]
            {
                if path_str.ends_with(".app") || path.is_dir() {
                    let mut cmd = Command::new("open");
                    cmd.arg("-a").arg(&path_str);
                    if let Some(ref args) = args {
                        for arg in args {
                            cmd.arg(arg);
                        }
                    }
                    cmd.spawn()
                        .map_err(|e| format!("Startup failed (open): {}", e))?;
                } else {
                    let mut cmd = Command::new(&path_str);
                    if let Some(ref args) = args {
                        for arg in args {
                            cmd.arg(arg);
                        }
                    }
                    cmd.spawn()
                        .map_err(|e| format!("Startup failed (direct): {}", e))?;
                }
            }

            #[cfg(not(target_os = "macos"))]
            {
                let mut cmd = Command::new(&path_str);
                if let Some(ref args) = args {
                    for arg in args {
                        cmd.arg(arg);
                    }
                }
                cmd.spawn().map_err(|e| format!("Startup failed: {}", e))?;
            }

            return Ok(());
        }
    }

    // Fallback: Default startup
    #[cfg(target_os = "macos")]
    {
        let mut cmd = Command::new("open");
        cmd.arg("-a").arg(&target_app);
        if let Some(ref args) = args {
            for arg in args {
                cmd.arg(arg);
            }
        }
        cmd.spawn().map_err(|e| format!("Startup failed: {}", e))?;
    }

    #[cfg(target_os = "windows")]
    {
        let exe_name = format!("{}.exe", target_app);
        if let Some(detected_path) = get_antigravity_executable_path() {
            let mut cmd = Command::new(detected_path);
            if let Some(ref args) = args {
                for arg in args {
                    cmd.arg(arg);
                }
            }
            cmd.spawn().map_err(|e| format!("Startup failed: {}", e))?;
        } else {
            // Protocol fallback
            let protocol = format!("{}://", target_app.to_lowercase());
            Command::new("cmd")
                .args(["/C", "start", &protocol])
                .spawn()
                .map_err(|e| format!("Startup fallback failed: {}", e))?;
        }
    }

    #[cfg(target_os = "linux")]
    {
        let mut cmd = Command::new(target_app.to_lowercase());
        if let Some(ref args) = args {
            for arg in args {
                cmd.arg(arg);
            }
        }
        cmd.spawn().map_err(|e| format!("Startup failed: {}", e))?;
    }

    Ok(())
}

/// Get arguments from the running process
pub fn get_args_from_running_process() -> Option<Vec<String>> {
    let mut system = System::new_all();
    system.refresh_all();
    let target_app = crate::modules::config::load_app_config()
        .map(|c| c.target_app_name)
        .unwrap_or_else(|_| "Antigravity".to_string());
    let target_app_lower = target_app.to_lowercase();

    for (_, process) in system.processes() {
        let name = process.name().to_string_lossy().to_lowercase();
        if name.contains(&target_app_lower) && !name.contains("tools") {
            let cmd = process
                .cmd()
                .iter()
                .map(|s| s.to_string_lossy().to_string())
                .collect::<Vec<_>>();
            // Simple heuristic to avoid helpers
            let cmd_str = cmd.join(" ");
            if !cmd_str.contains("--type=") {
                return Some(cmd);
            }
        }
    }
    None
}

/// Get --user-data-dir argument value (if exists)
pub fn get_user_data_dir_from_process() -> Option<std::path::PathBuf> {
    let config = crate::modules::config::load_app_config().ok();
    let args_from_config = config.and_then(|c| c.antigravity_args);

    let args = if let Some(a) = args_from_config {
        a
    } else {
        // Fallback to running process info
        get_args_from_running_process().unwrap_or_default()
    };

    for i in 0..args.len() {
        if args[i] == "--user-data-dir" && i + 1 < args.len() {
            return Some(std::path::PathBuf::from(&args[i + 1]));
        } else if args[i].starts_with("--user-data-dir=") {
            let parts: Vec<&str> = args[i].splitn(2, '=').collect();
            if parts.len() == 2 {
                return Some(std::path::PathBuf::from(parts[1]));
            }
        }
    }
    None
}

/// Get Antigravity executable path (cross-platform)
pub fn get_antigravity_executable_path() -> Option<std::path::PathBuf> {
    // Strategy 1: Check manual config
    if let Ok(config) = crate::modules::config::load_app_config() {
        if let Some(path_str) = config.antigravity_executable {
            let path = std::path::PathBuf::from(path_str);
            if path.exists() {
                return Some(path);
            }
        }
    }

    // Strategy 2: Check standard installation locations
    check_standard_locations()
}

/// Check standard installation locations
fn check_standard_locations() -> Option<std::path::PathBuf> {
    let target_app = crate::modules::config::load_app_config()
        .map(|c| c.target_app_name)
        .unwrap_or_else(|_| "Antigravity".to_string());

    #[cfg(target_os = "macos")]
    {
        let path = std::path::PathBuf::from(format!("/Applications/{}.app", target_app));
        if path.exists() {
            return Some(path);
        }
    }

    #[cfg(target_os = "windows")]
    {
        use std::env;
        let local_appdata = env::var("LOCALAPPDATA").ok();
        let program_files = env::var("ProgramFiles").ok();
        let exe_name = format!("{}.exe", target_app);

        if let Some(local) = local_appdata {
            let p = std::path::PathBuf::from(local)
                .join("Programs")
                .join(&target_app)
                .join(&exe_name);
            if p.exists() {
                return Some(p);
            }
        }
        if let Some(pf) = program_files {
            let p = std::path::PathBuf::from(pf)
                .join(&target_app)
                .join(&exe_name);
            if p.exists() {
                return Some(p);
            }
        }
    }

    #[cfg(target_os = "linux")]
    {
        let target_app_lower = target_app.to_lowercase();
        let paths = vec![
            format!("/usr/bin/{}", target_app_lower),
            format!("/opt/{}/{}", target_app, target_app_lower),
        ];
        for p in paths {
            let path = std::path::PathBuf::from(p);
            if path.exists() {
                return Some(path);
            }
        }
    }

    None
}
