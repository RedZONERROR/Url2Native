import fs from "node:fs";
import path from "node:path";

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeJsString(value) {
  return JSON.stringify(String(value)).slice(1, -1);
}

function renderTemplate(template, replacements) {
  let output = template;
  for (const [key, val] of Object.entries(replacements)) {
    output = output.split(`{{${key}}}`).join(val);
  }
  return output;
}

function buildBootstrapIndexHtml(config) {
  const safeAppName = escapeHtml(config.app.name);
  const safeUrlJs = escapeJsString(config.app.url);
  const safeBg = escapeHtml(config.errorScreen.backgroundColor);
  const safeText = escapeHtml(config.errorScreen.textColor);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${safeAppName}</title>
  <style>
    html, body {
      margin: 0;
      padding: 0;
      width: 100%;
      height: 100%;
      background-color: ${safeBg};
      color: ${safeText};
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .loader {
      width: 2rem;
      height: 2rem;
      border: 3px solid rgba(128, 128, 128, 0.25);
      border-top-color: ${escapeHtml(config.errorScreen.accentColor)};
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  </style>
</head>
<body>
  <div class="loader" aria-label="Loading ${safeAppName}"></div>
  <script>
    (function () {
      var targetUrl = "${safeUrlJs}";
      var invoke = window.__TAURI__ && window.__TAURI__.core && window.__TAURI__.core.invoke;

      if (typeof invoke === "function") {
        invoke("launch_with_prefixed_ua", {
          runtimeUa: navigator.userAgent,
          online: navigator.onLine
        }).catch(function () {
          var winApi = window.__TAURI__ && window.__TAURI__.window;
          if (winApi && typeof winApi.getCurrentWindow === "function") {
            winApi.getCurrentWindow().show().catch(function () {});
          }
          window.location.replace(navigator.onLine ? targetUrl : "offline.html");
        });
        return;
      }

      if (!navigator.onLine) {
        window.location.replace("offline.html");
        return;
      }

      window.location.replace(targetUrl);
    })();
  </script>
</body>
</html>
`;
}

export function generateUi({ rootDir, config }) {
  const offlineTemplatePath = path.join(rootDir, "ui", "offline.template.html");
  const navbarTemplatePath = path.join(rootDir, "ui", "navbar.template.html");

  const offlineTemplate = fs.readFileSync(offlineTemplatePath, "utf8");
  const renderedOffline = renderTemplate(offlineTemplate, {
    APP_NAME: escapeHtml(config.app.name),
    ERROR_TITLE: escapeHtml(config.errorScreen.title),
    ERROR_MESSAGE: escapeHtml(config.errorScreen.message),
    RETRY_TEXT: escapeHtml(config.errorScreen.retryButtonText),
    ACCENT_COLOR: escapeHtml(config.errorScreen.accentColor),
    BG_COLOR: escapeHtml(config.errorScreen.backgroundColor),
    TEXT_COLOR: escapeHtml(config.errorScreen.textColor),
    TARGET_URL: escapeJsString(config.app.url)
  });

  const distDir = path.join(rootDir, "dist");
  fs.mkdirSync(distDir, { recursive: true });
  fs.writeFileSync(path.join(distDir, "offline.html"), renderedOffline, "utf8");
  fs.writeFileSync(path.join(distDir, "index.html"), buildBootstrapIndexHtml(config), "utf8");

  if (config.navigation.enabled && fs.existsSync(navbarTemplatePath)) {
    const navbarTemplate = fs.readFileSync(navbarTemplatePath, "utf8");
    const safeButtonsJson = JSON.stringify(config.navigation.buttons);
    const renderedNavbar = renderTemplate(navbarTemplate, {
      APP_NAME: escapeHtml(config.app.name),
      NAV_BG_COLOR: escapeHtml(config.navigation.backgroundColor),
      NAV_ICON_COLOR: escapeHtml(config.navigation.iconColor),
      NAV_POSITION: escapeHtml(config.navigation.position),
      NAV_BUTTONS_JSON: safeButtonsJson,
      TARGET_URL: escapeJsString(config.app.url)
    });
    fs.writeFileSync(path.join(distDir, "navbar.html"), renderedNavbar, "utf8");
  }

  // Sync runtime config for Rust compile-time embedding
  const serializedConfig = JSON.stringify(config, null, 2) + "\n";
  fs.writeFileSync(path.join(rootDir, "src-tauri", "app.config.json"), serializedConfig, "utf8");

  // Sync assets for Android template and generated Android project
  const androidAssetsTargets = [path.join(rootDir, "android-template", "assets")];
  const genAssets = path.join(
    rootDir,
    "src-tauri",
    "gen",
    "android",
    "app",
    "src",
    "main",
    "assets"
  );
  if (fs.existsSync(path.join(rootDir, "src-tauri", "gen", "android"))) {
    androidAssetsTargets.push(genAssets);
  }

  for (const dir of androidAssetsTargets) {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "offline.html"), renderedOffline, "utf8");
    fs.writeFileSync(path.join(dir, "app.config.json"), serializedConfig, "utf8");
  }
}
