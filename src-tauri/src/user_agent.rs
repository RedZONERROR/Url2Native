use crate::config::{UserAgentMode, UserAgentSection};

/// Resolves a direct User-Agent override when the mode does not require
/// querying the runtime WebView engine first.
pub fn resolve_static_user_agent(config: &UserAgentSection) -> Option<String> {
    match config.mode {
        UserAgentMode::Default => None,
        UserAgentMode::Replace => {
            let trimmed = config.value.trim();
            if trimmed.is_empty() {
                None
            } else {
                Some(trimmed.to_string())
            }
        }
        UserAgentMode::Append => None,
    }
}

/// Combines the runtime native WebView User-Agent with the configured suffix.
pub fn build_appended_user_agent(runtime_ua: &str, suffix: &str) -> String {
    let base = runtime_ua.trim();
    let extra = suffix.trim();
    if base.is_empty() {
        return extra.to_string();
    }
    if extra.is_empty() {
        return base.to_string();
    }
    if base.contains(extra) {
        return base.to_string();
    }
    format!("{base} {extra}")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn append_combines_runtime_and_custom_suffix() {
        let out = build_appended_user_agent("Mozilla/5.0", "Url2Native/1.0");
        assert_eq!(out, "Mozilla/5.0 Url2Native/1.0");
    }

    #[test]
    fn append_avoids_duplicate_suffix() {
        let out = build_appended_user_agent("Mozilla/5.0 Url2Native/1.0", "Url2Native/1.0");
        assert_eq!(out, "Mozilla/5.0 Url2Native/1.0");
    }

    #[test]
    fn resolve_static_handles_modes() {
        let replace = UserAgentSection {
            mode: UserAgentMode::Replace,
            value: "CustomAgent/2.0".into(),
        };
        assert_eq!(
            resolve_static_user_agent(&replace),
            Some("CustomAgent/2.0".into())
        );

        let default = UserAgentSection {
            mode: UserAgentMode::Default,
            value: "Ignored".into(),
        };
        assert_eq!(resolve_static_user_agent(&default), None);
    }
}
