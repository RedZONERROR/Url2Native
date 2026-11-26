pub const NATIVE_APP_USER_AGENT_PREFIX: &str = "NativeApp/1.0";

/// Prepends `NativeApp/1.0` to the runtime native WebView User-Agent string
/// without replacing the underlying browser engine identification.
pub fn build_prefixed_user_agent(runtime_ua: &str) -> String {
    let base = runtime_ua.trim();
    if base.is_empty() {
        return NATIVE_APP_USER_AGENT_PREFIX.to_string();
    }
    if base.starts_with(NATIVE_APP_USER_AGENT_PREFIX) {
        return base.to_string();
    }
    format!("{NATIVE_APP_USER_AGENT_PREFIX} {base}")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn prepends_native_app_prefix() {
        let out = build_prefixed_user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64)");
        assert_eq!(
            out,
            "NativeApp/1.0 Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
        );
    }

    #[test]
    fn avoids_duplicate_prefix() {
        let out = build_prefixed_user_agent("NativeApp/1.0 Mozilla/5.0");
        assert_eq!(out, "NativeApp/1.0 Mozilla/5.0");
    }

    #[test]
    fn handles_empty_runtime_ua() {
        assert_eq!(build_prefixed_user_agent("   "), "NativeApp/1.0");
    }
}
