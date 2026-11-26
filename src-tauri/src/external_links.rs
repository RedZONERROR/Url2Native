use url::Url;

use crate::config::AppConfig;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum NavigationDecision {
    AllowInApp,
    OpenExternal,
    Deny,
}

fn normalize_host(host: &str) -> String {
    host.trim().trim_start_matches("www.").to_ascii_lowercase()
}

fn host_matches_domain(host: &str, domain: &str) -> bool {
    let h = normalize_host(host);
    let d = normalize_host(domain.trim_start_matches("*."));
    if h.is_empty() || d.is_empty() {
        return false;
    }
    h == d || h.ends_with(&format!(".{d}"))
}

/// Evaluates whether a navigation URL should remain inside the WebView or be
/// handed off to the host operating system.
pub fn evaluate_navigation(url: &Url, config: &AppConfig) -> NavigationDecision {
    let scheme = url.scheme().to_ascii_lowercase();

    // Always allow internal Tauri and WebView schemes.
    if matches!(
        scheme.as_str(),
        "tauri" | "about" | "blob" | "data" | "javascript"
    ) {
        return NavigationDecision::AllowInApp;
    }

    // Internal Tauri localhost host on Windows/Android.
    if let Some(host) = url.host_str() {
        if host.eq_ignore_ascii_case("tauri.localhost") {
            return NavigationDecision::AllowInApp;
        }
    }

    // Intercept configured external schemes (upi, whatsapp, tel, mailto, intent, etc.).
    if config
        .behavior
        .external_schemes
        .iter()
        .any(|s| s.eq_ignore_ascii_case(&scheme))
    {
        return NavigationDecision::OpenExternal;
    }

    if scheme != "http" && scheme != "https" {
        return NavigationDecision::OpenExternal;
    }

    if config.behavior.keep_external_domains_in_app {
        return NavigationDecision::AllowInApp;
    }

    let target_host = match url.host_str() {
        Some(host) => host,
        None => return NavigationDecision::Deny,
    };

    if let Ok(root_url) = Url::parse(&config.app.url) {
        if let Some(root_host) = root_url.host_str() {
            if host_matches_domain(target_host, root_host) {
                return NavigationDecision::AllowInApp;
            }
        }
    }

    if config
        .behavior
        .allowed_domains
        .iter()
        .any(|allowed| host_matches_domain(target_host, allowed))
    {
        return NavigationDecision::AllowInApp;
    }

    NavigationDecision::OpenExternal
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn external_schemes_open_externally() {
        let cfg = AppConfig::load().expect("config loads");
        let upi = Url::parse("upi://pay?pa=test@upi").unwrap();
        assert_eq!(evaluate_navigation(&upi, &cfg), NavigationDecision::OpenExternal);

        let tel = Url::parse("tel:+1234567890").unwrap();
        assert_eq!(evaluate_navigation(&tel, &cfg), NavigationDecision::OpenExternal);
    }

    #[test]
    fn root_and_subdomains_stay_in_app() {
        let cfg = AppConfig::load().expect("config loads");
        let sub = Url::parse("https://app.example.com/dashboard").unwrap();
        assert_eq!(evaluate_navigation(&sub, &cfg), NavigationDecision::AllowInApp);

        let ext = Url::parse("https://other-site.org/page").unwrap();
        assert_eq!(evaluate_navigation(&ext, &cfg), NavigationDecision::OpenExternal);
    }
}
