use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use tauri::State;
use tauri::Manager;

// ── Data Types ──────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PluginFeature {
    pub code: String,
    pub explain: String,
    pub cmds: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ui: Option<PluginUi>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PluginUi {
    #[serde(rename = "displayType")]
    pub display_type: String,
    pub label: String,
    pub icon: String,
    pub color: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Plugin {
    pub id: String,
    pub name: String,
    pub version: String,
    pub logo: String,
    #[serde(rename = "entryType")]
    pub entry_type: String,
    pub main: String,
    pub features: Vec<PluginFeature>,
}

// ── App State ───────────────────────────────────────────────

pub struct AppState {
    data_dir: PathBuf,
    plugins_dir: PathBuf,
}

impl AppState {
    fn db_path(&self) -> PathBuf {
        self.data_dir.join("db.json")
    }

    fn load_db(&self) -> HashMap<String, serde_json::Value> {
        let path = self.db_path();
        if path.exists() {
            let data = fs::read_to_string(&path).unwrap_or_default();
            serde_json::from_str(&data).unwrap_or_default()
        } else {
            HashMap::new()
        }
    }

    fn save_db(&self, db: &HashMap<String, serde_json::Value>) {
        let path = self.db_path();
        let json = serde_json::to_string_pretty(db).unwrap_or_default();
        let _ = fs::create_dir_all(path.parent().unwrap());
        let _ = fs::write(path, json);
    }

    /// Scan a directory for plugins (subdirs with plugin.json)
    fn scan_dir(&self, dir: &PathBuf) -> Vec<Plugin> {
        let mut plugins = Vec::new();
        if !dir.exists() {
            return plugins;
        }
        if let Ok(entries) = fs::read_dir(dir) {
            for entry in entries.flatten() {
                if !entry.file_type().map(|t| t.is_dir()).unwrap_or(false) {
                    continue;
                }
                let plugin_json = entry.path().join("plugin.json");
                if !plugin_json.exists() {
                    continue;
                }
                if let Ok(data) = fs::read_to_string(&plugin_json) {
                    if let Ok(mut plugin) = serde_json::from_str::<Plugin>(&data) {
                        // Use absolute path with forward slashes for file:// protocol
                        let html_path = entry.path().join(&plugin.main);
                        let path_str = html_path.to_string_lossy().to_string();
                        plugin.main = path_str.replace('\\', "/");
                        log::info!("Discovered: {} ({}) -> {}", plugin.name, plugin.id, plugin.main);
                        plugins.push(plugin);
                    }
                }
            }
        }
        plugins
    }

    /// Get all plugins from filesystem (no hardcoded defaults)
    fn get_all_plugins(&self) -> Vec<Plugin> {
        let mut plugins = self.scan_dir(&self.plugins_dir);
        log::info!("Scanned user plugins dir: {} -> {} plugins", self.plugins_dir.display(), plugins.len());

        // Dev mode: scan project's public/plugins/ (CWD is src-tauri/, go up 1 level)
        if let Ok(cwd) = std::env::current_dir() {
            log::info!("CWD: {}", cwd.display());
            if let Some(project_root) = cwd.parent() {
                let dev_plugins = project_root.join("public").join("plugins");
                log::info!("Dev plugins dir: {}", dev_plugins.display());
                for p in self.scan_dir(&dev_plugins) {
                    if !plugins.iter().any(|existing| existing.id == p.id) {
                        plugins.push(p);
                    }
                }
            }
        }

        // Portable mode: scan exe's parent plugins/ directory
        if let Ok(exe_dir) = std::env::current_exe() {
            if let Some(parent) = exe_dir.parent() {
                let portable_plugins = parent.join("plugins");
                for p in self.scan_dir(&portable_plugins) {
                    if !plugins.iter().any(|existing| existing.id == p.id) {
                        plugins.push(p);
                    }
                }
            }
        }

        plugins
    }
}

// ── Tauri Commands ──────────────────────────────────────────

#[tauri::command]
fn get_installed_plugins(state: State<'_, AppState>) -> Vec<Plugin> {
    state.get_all_plugins()
}

#[tauri::command]
fn scan_plugins(state: State<'_, AppState>) -> serde_json::Value {
    let plugins = state.get_all_plugins();
    serde_json::json!({ "success": true, "count": plugins.len(), "plugins": plugins })
}

#[tauri::command]
fn install_plugin(state: State<'_, AppState>, plugin: Plugin) -> serde_json::Value {
    let plugin_dir = state.plugins_dir.join(&plugin.id);
    let _ = fs::create_dir_all(&plugin_dir);
    let mut plugin_to_save = plugin.clone();
    if plugin_to_save.main.is_empty() || plugin_to_save.main.starts_with("plugins/") {
        plugin_to_save.main = "index.html".into();
    }
    let json = serde_json::to_string_pretty(&plugin_to_save).unwrap_or_default();
    let _ = fs::write(plugin_dir.join("plugin.json"), json);
    serde_json::json!({ "success": true, "plugins": state.get_all_plugins() })
}

#[tauri::command(rename_all = "camelCase")]
fn uninstall_plugin(state: State<'_, AppState>, plugin_id: String) -> serde_json::Value {
    let plugin_dir = state.plugins_dir.join(&plugin_id);
    if plugin_dir.exists() {
        let _ = fs::remove_dir_all(&plugin_dir);
    }
    serde_json::json!({ "success": true, "plugins": state.get_all_plugins() })
}

#[tauri::command(rename_all = "camelCase")]
fn plugin_db_put(state: State<'_, AppState>, plugin_id: String, key: String, value: serde_json::Value) -> serde_json::Value {
    let mut db = state.load_db();
    let ns = format!("plugin_isolated:{}:{}", plugin_id, key);
    db.insert(ns, value);
    state.save_db(&db);
    serde_json::json!({ "success": true })
}

#[tauri::command(rename_all = "camelCase")]
fn plugin_db_get(state: State<'_, AppState>, plugin_id: String, key: String) -> serde_json::Value {
    let db = state.load_db();
    let ns = format!("plugin_isolated:{}:{}", plugin_id, key);
    db.get(&ns).cloned().unwrap_or(serde_json::Value::Null)
}

#[tauri::command(rename_all = "camelCase")]
fn plugin_db_remove(state: State<'_, AppState>, plugin_id: String, key: String) -> serde_json::Value {
    let mut db = state.load_db();
    let ns = format!("plugin_isolated:{}:{}", plugin_id, key);
    db.remove(&ns);
    state.save_db(&db);
    serde_json::json!({ "success": true })
}

#[tauri::command]
fn list_db_keys(state: State<'_, AppState>) -> Vec<serde_json::Value> {
    let db = state.load_db();
    let mut result = Vec::new();
    for (ns_key, value) in &db {
        if let Some(rest) = ns_key.strip_prefix("plugin_isolated:") {
            if let Some((plugin_id, key)) = rest.split_once(':') {
                result.push(serde_json::json!({
                    "pluginId": plugin_id,
                    "key": key,
                    "value": value.to_string()
                }));
            }
        }
    }
    result
}

#[tauri::command(rename_all = "camelCase")]
fn mount_webview_plugin(plugin_id: String, relative_path: String) -> serde_json::Value {
    log::info!("Mounting webview plugin: {} at {}", plugin_id, relative_path);
    serde_json::json!({ "success": true })
}

#[tauri::command(rename_all = "camelCase")]
fn destroy_webview_plugin(plugin_id: String) -> serde_json::Value {
    log::info!("Destroying webview plugin: {}", plugin_id);
    serde_json::json!({ "success": true })
}

#[tauri::command]
fn open_native_url(url: String) -> serde_json::Value {
    log::info!("Opening native URL: {}", url);
    let _ = open::that(&url);
    serde_json::json!({ "success": true })
}

#[tauri::command(rename_all = "camelCase")]
fn open_plugin_window(
    app: tauri::AppHandle,
    plugin_id: String,
    title: String,
    url: String,
) -> serde_json::Value {
    use tauri::WebviewUrl;
    use tauri::WebviewWindowBuilder;

    let label = format!("plugin-{}", plugin_id);

    // Check if window already exists
    if app.get_webview_window(&label).is_some() {
        if let Some(win) = app.get_webview_window(&label) {
            let _ = win.set_focus();
        }
        return serde_json::json!({ "success": true, "message": "window already exists" });
    }

    let _ = WebviewWindowBuilder::new(&app, &label, WebviewUrl::App(url.into()))
        .title(&title)
        .inner_size(900.0, 600.0)
        .resizable(true)
        .closable(true)
        .decorations(true)
        .build();

    log::info!("Opened plugin window: {} ({})", plugin_id, title);
    serde_json::json!({ "success": true })
}

// ── Entry Point ─────────────────────────────────────────────

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let data_dir = app
                .path()
                .app_data_dir()
                .expect("Failed to resolve app data dir");
            let _ = fs::create_dir_all(&data_dir);

            let plugins_dir = data_dir.join("plugins");
            let _ = fs::create_dir_all(&plugins_dir);

            log::info!("Plugins dir: {}", plugins_dir.display());

            app.manage(AppState { data_dir, plugins_dir });

            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_installed_plugins,
            scan_plugins,
            install_plugin,
            uninstall_plugin,
            plugin_db_put,
            plugin_db_get,
            plugin_db_remove,
            list_db_keys,
            mount_webview_plugin,
            destroy_webview_plugin,
            open_native_url,
            open_plugin_window,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
