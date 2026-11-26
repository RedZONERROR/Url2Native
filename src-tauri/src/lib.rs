mod config;
mod external_links;
mod power_manager;
mod user_agent;

use std::sync::Mutex;
#[cfg(desktop)]
use tauri::Manager;
use tauri::{AppHandle, State, WebviewUrl, WebviewWindow, WebviewWindowBuilder};
use tauri_plugin_opener::OpenerExt;
use url::Url;

use config::AppConfig;
#[cfg(desktop)]
use config::UserAgentMode;
use external_links::{evaluate_navigation, NavigationDecision};
use power_manager::WakeLockGuard;
use user_agent::{build_appended_user_agent, resolve_static_user_agent};

struct AppState {
    config: AppConfig,
    _wake_lock: Mutex<Option<WakeLockGuard>>,
}

#[tauri::command]
fn get_app_config(state: State<'_, AppState>) -> AppConfig {
    state.config.clone()
}

#[tauri::command]
fn retry_connection(window: WebviewWindow, state: State<'_, AppState>) -> Result<(), String> {
    let target = Url::parse(&state.config.app.url)
        .map_err(|err| format!("Invalid target URL: {err}"))?;
    window
        .navigate(target)
        .map_err(|err| format!("Failed to reload target URL: {err}"))
}

#[tauri::command]
fn launch_with_appended_ua(
    app: AppHandle,
    window: WebviewWindow,
    state: State<'_, AppState>,
    runtime_ua: String,
) -> Result<(), String> {
    let full_ua = build_appended_user_agent(&runtime_ua, &state.config.user_agent.value);
    let target = Url::parse(&state.config.app.url)
        .map_err(|err| format!("Invalid target URL: {err}"))?;

    create_configured_window(
        &app,
        "app",
        WebviewUrl::External(target),
        Some(full_ua),
        true,
        &state.config,
    )
    .map_err(|err| format!("Failed to create application window: {err}"))?;

    let _ = window.close();
    Ok(())
}

fn build_init_script(config: &AppConfig) -> String {
    let nav_json = serde_json::to_string(&config.navigation).unwrap_or_else(|_| "{}".into());
    let home_url_json = serde_json::to_string(&config.app.url).unwrap_or_else(|_| "\"\"".into());
    let error_json = serde_json::to_string(&config.error_screen).unwrap_or_else(|_| "{}".into());

    format!(
        r####"(function () {{
  var NAV_CFG = {nav_json};
  var HOME_URL = {home_url_json};
  var ERR_CFG = {error_json};

  function injectNavbar() {{
    if (!NAV_CFG || !NAV_CFG.enabled) return;
    if (window.location.protocol === "tauri:" || window.location.hostname === "tauri.localhost") return;
    if (document.getElementById("url2native-nav-host")) return;
    if (!document.body) return;

    var host = document.createElement("div");
    host.id = "url2native-nav-host";
    host.style.position = "fixed";
    host.style.left = "0";
    host.style.right = "0";
    host.style.zIndex = "2147483647";
    if (NAV_CFG.position === "top") {{
      host.style.top = "0";
      document.documentElement.style.paddingTop = "3.25rem";
    }} else {{
      host.style.bottom = "0";
      document.documentElement.style.paddingBottom = "3.25rem";
    }}

    var shadow = host.attachShadow({{ mode: "closed" }});
    var style = document.createElement("style");
    style.textContent = [
      ".u2n-bar {{ display:flex; align-items:center; justify-content:space-around; min-height:3.25rem; padding:0.375rem 0.5rem; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; box-sizing:border-box; }}",
      ".u2n-btn {{ display:inline-flex; align-items:center; gap:0.375rem; min-height:2.5rem; padding:0.375rem 0.875rem; border:none; border-radius:0.5rem; background:transparent; color:inherit; font-size:0.875rem; font-weight:500; cursor:pointer; }}",
      ".u2n-btn:hover {{ background:rgba(255,255,255,0.12); }}"
    ].join("\n");
    shadow.appendChild(style);

    var bar = document.createElement("nav");
    bar.className = "u2n-bar";
    bar.style.backgroundColor = NAV_CFG.backgroundColor || "#111827";
    bar.style.color = NAV_CFG.iconColor || "#FFFFFF";

    (NAV_CFG.buttons || []).forEach(function (item) {{
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "u2n-btn";
      btn.textContent = item.label || "";
      btn.addEventListener("click", function () {{
        if (item.url) {{
          window.location.href = item.url;
        }} else if (item.action === "back") {{
          window.history.back();
        }} else if (item.action === "forward") {{
          window.history.forward();
        }} else if (item.action === "home") {{
          window.location.href = HOME_URL;
        }} else if (item.action === "reload") {{
          window.location.reload();
        }}
      }});
      bar.appendChild(btn);
    }});

    shadow.appendChild(bar);
    document.body.appendChild(host);
  }}

  function showOfflineBanner() {{
    if (document.getElementById("url2native-offline-overlay")) return;
    if (!document.body) return;
    var overlay = document.createElement("div");
    overlay.id = "url2native-offline-overlay";
    overlay.style.cssText = "position:fixed;inset:0;z-index:2147483647;display:flex;align-items:center;justify-content:center;padding:1.5rem;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;";
    overlay.style.backgroundColor = ERR_CFG.backgroundColor || "#FFFFFF";
    overlay.style.color = ERR_CFG.textColor || "#111827";

    var box = document.createElement("div");
    box.style.cssText = "max-width:26rem;text-align:center;display:flex;flex-direction:column;align-items:center;gap:1rem;";

    var h = document.createElement("h1");
    h.style.cssText = "margin:0;font-size:1.5rem;font-weight:700;";
    h.textContent = ERR_CFG.title || "Connection Unavailable";

    var p = document.createElement("p");
    p.style.cssText = "margin:0;font-size:1rem;line-height:1.5;opacity:0.85;";
    p.textContent = ERR_CFG.message || "Unable to reach the server.";

    var btn = document.createElement("button");
    btn.type = "button";
    btn.style.cssText = "padding:0.75rem 1.5rem;border:none;border-radius:0.5rem;color:#FFFFFF;font-size:1rem;font-weight:600;cursor:pointer;";
    btn.style.backgroundColor = ERR_CFG.accentColor || "#2563EB";
    btn.textContent = ERR_CFG.retryButtonText || "Retry Connection";
    btn.addEventListener("click", function () {{
      overlay.remove();
      window.location.reload();
    }});

    box.appendChild(h);
    box.appendChild(p);
    box.appendChild(btn);
    overlay.appendChild(box);
    document.body.appendChild(overlay);
  }}

  if (document.readyState === "loading") {{
    document.addEventListener("DOMContentLoaded", injectNavbar);
  }} else {{
    injectNavbar();
  }}

  window.addEventListener("offline", showOfflineBanner);
}})();"####
    )
}

fn create_configured_window(
    app: &AppHandle,
    label: &str,
    initial_url: WebviewUrl,
    ua_override: Option<String>,
    visible: bool,
    config: &AppConfig,
) -> tauri::Result<WebviewWindow> {
    let nav_config = config.clone();
    let app_for_nav = app.clone();

    let mut builder = WebviewWindowBuilder::new(app, label, initial_url)
        .title(&config.app.name)
        .initialization_script(&build_init_script(config))
        .on_navigation(move |url| match evaluate_navigation(url, &nav_config) {
            NavigationDecision::AllowInApp => true,
            NavigationDecision::OpenExternal => {
                let _ = app_for_nav.opener().open_url(url.as_str(), None::<&str>);
                false
            }
            NavigationDecision::Deny => false,
        });

    if let Some(ua) = ua_override {
        builder = builder.user_agent(&ua);
    }

    #[cfg(desktop)]
    {
        let new_win_config = config.clone();
        let app_for_new_win = app.clone();

        builder = builder
            .inner_size(1280.0, 800.0)
            .min_inner_size(360.0, 480.0)
            .visible(visible)
            .on_new_window(move |url, _features| {
                match evaluate_navigation(&url, &new_win_config) {
                    NavigationDecision::AllowInApp => {
                        if let Some(win) = app_for_new_win.get_webview_window("app").or_else(|| {
                            app_for_new_win.get_webview_window("main")
                        }) {
                            let _ = win.navigate(url);
                        }
                    }
                    NavigationDecision::OpenExternal => {
                        let _ = app_for_new_win
                            .opener()
                            .open_url(url.as_str(), None::<&str>);
                    }
                    NavigationDecision::Deny => {}
                }
                tauri::webview::NewWindowResponse::Deny
            });
    }

    #[cfg(not(desktop))]
    {
        let _ = visible;
    }

    builder.build()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let config = AppConfig::load().expect("Failed to load embedded app.config.json");
    let wake_lock = if config.behavior.prevent_brightness_drop {
        Some(WakeLockGuard::acquire(&config.app.name))
    } else {
        None
    };

    let setup_config = config.clone();

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(AppState {
            config,
            _wake_lock: Mutex::new(wake_lock),
        })
        .invoke_handler(tauri::generate_handler![
            get_app_config,
            retry_connection,
            launch_with_appended_ua
        ])
        .setup(move |app| {
            let handle = app.handle();
            let target_url = Url::parse(&setup_config.app.url)
                .map_err(|err| format!("Invalid app.url in app.config.json: {err}"))?;

            #[cfg(desktop)]
            {
                if setup_config.user_agent.mode == UserAgentMode::Append {
                    // Launch hidden bootstrap window first to read runtime WebView UA.
                    create_configured_window(
                        handle,
                        "main",
                        WebviewUrl::App("index.html".into()),
                        None,
                        false,
                        &setup_config,
                    )?;
                } else {
                    let static_ua = resolve_static_user_agent(&setup_config.user_agent);
                    create_configured_window(
                        handle,
                        "main",
                        WebviewUrl::External(target_url),
                        static_ua,
                        true,
                        &setup_config,
                    )?;
                }
            }

            #[cfg(mobile)]
            {
                let static_ua = resolve_static_user_agent(&setup_config.user_agent);
                create_configured_window(
                    handle,
                    "main",
                    WebviewUrl::External(target_url),
                    static_ua,
                    true,
                    &setup_config,
                )?;
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
