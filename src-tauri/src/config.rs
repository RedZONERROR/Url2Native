use serde::{Deserialize, Serialize};

const EMBEDDED_CONFIG: &str = include_str!("../app.config.json");

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppConfig {
    pub app: AppSection,
    pub user_agent: UserAgentSection,
    pub behavior: BehaviorSection,
    pub navigation: NavigationSection,
    pub error_screen: ErrorScreenSection,
    pub build: BuildSection,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppSection {
    pub name: String,
    pub package_id: String,
    pub version: String,
    pub url: String,
    pub icon: String,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UserAgentSection {
    pub mode: UserAgentMode,
    pub value: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum UserAgentMode {
    Default,
    Replace,
    Append,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BehaviorSection {
    pub pull_to_refresh: bool,
    pub smart_cache: bool,
    pub hardware_acceleration: bool,
    pub prevent_brightness_drop: bool,
    pub external_schemes: Vec<String>,
    pub keep_external_domains_in_app: bool,
    pub allowed_domains: Vec<String>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NavigationSection {
    pub enabled: bool,
    pub position: String,
    pub background_color: String,
    pub icon_color: String,
    pub buttons: Vec<NavigationButton>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NavigationButton {
    pub label: String,
    #[serde(default)]
    pub action: Option<String>,
    #[serde(default)]
    pub url: Option<String>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ErrorScreenSection {
    pub title: String,
    pub message: String,
    pub retry_button_text: String,
    pub accent_color: String,
    pub background_color: String,
    pub text_color: String,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BuildSection {
    pub android: bool,
    pub windows: bool,
    pub macos: bool,
    pub linux: bool,
}

impl AppConfig {
    pub fn load() -> Result<Self, String> {
        serde_json::from_str::<Self>(EMBEDDED_CONFIG)
            .map_err(|err| format!("Failed to parse embedded app.config.json: {err}"))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_embedded_config() {
        let cfg = AppConfig::load().expect("embedded app.config.json should be valid");
        assert!(!cfg.app.name.is_empty());
        assert!(cfg.app.url.starts_with("http"));
    }
}
