#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..");

function nonEmpty(value) {
  const trimmed = String(value ?? "").trim();
  return trimmed.length > 0 ? trimmed : null;
}

function resolveChoiceToggle(envVal, currentVal) {
  const norm = String(envVal ?? "config").trim().toLowerCase();
  if (norm === "enable" || norm === "true") return true;
  if (norm === "disable" || norm === "false") return false;
  return Boolean(currentVal);
}

function resolveChoiceValue(envVal, currentVal) {
  const norm = String(envVal ?? "config").trim();
  if (!norm || norm.toLowerCase() === "config") return currentVal;
  return norm;
}

function resolveCommaList(envVal, currentVal) {
  const trimmed = nonEmpty(envVal);
  if (!trimmed) return currentVal;
  if (trimmed.toLowerCase() === "none" || trimmed.toLowerCase() === "clear") {
    return [];
  }
  return trimmed
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function applyCiOverrides(config, env = process.env) {
  const cfg = structuredClone(config);

  const appName = nonEmpty(env.INPUT_APP_NAME);
  const packageId = nonEmpty(env.INPUT_PACKAGE_ID);
  const appUrl = nonEmpty(env.INPUT_APP_URL);
  const appVersion = nonEmpty(env.INPUT_APP_VERSION);
  if (appName) cfg.app.name = appName;
  if (packageId) cfg.app.packageId = packageId;
  if (appUrl) cfg.app.url = appUrl;
  if (appVersion) cfg.app.version = appVersion;

  cfg.userAgent.mode = resolveChoiceValue(env.INPUT_USER_AGENT_MODE, cfg.userAgent.mode);
  const uaValue = nonEmpty(env.INPUT_USER_AGENT_VALUE);
  if (uaValue) cfg.userAgent.value = uaValue;

  cfg.navigation.enabled = resolveChoiceToggle(env.INPUT_NAVIGATION_ENABLED, cfg.navigation.enabled);
  cfg.navigation.position = resolveChoiceValue(env.INPUT_NAVIGATION_POSITION, cfg.navigation.position);
  const navBg = nonEmpty(env.INPUT_NAVIGATION_BG_COLOR);
  const navIcon = nonEmpty(env.INPUT_NAVIGATION_ICON_COLOR);
  if (navBg) cfg.navigation.backgroundColor = navBg;
  if (navIcon) cfg.navigation.iconColor = navIcon;

  cfg.behavior.pullToRefresh = resolveChoiceToggle(env.INPUT_PULL_TO_REFRESH, cfg.behavior.pullToRefresh);
  cfg.behavior.smartCache = resolveChoiceToggle(env.INPUT_SMART_CACHE, cfg.behavior.smartCache);
  cfg.behavior.hardwareAcceleration = resolveChoiceToggle(
    env.INPUT_HARDWARE_ACCELERATION,
    cfg.behavior.hardwareAcceleration
  );
  cfg.behavior.preventBrightnessDrop = resolveChoiceToggle(
    env.INPUT_PREVENT_BRIGHTNESS_DROP,
    cfg.behavior.preventBrightnessDrop
  );
  cfg.behavior.keepExternalDomainsInApp = resolveChoiceToggle(
    env.INPUT_KEEP_EXTERNAL_DOMAINS,
    cfg.behavior.keepExternalDomainsInApp
  );
  cfg.behavior.allowedDomains = resolveCommaList(env.INPUT_ALLOWED_DOMAINS, cfg.behavior.allowedDomains);
  cfg.behavior.externalSchemes = resolveCommaList(env.INPUT_EXTERNAL_SCHEMES, cfg.behavior.externalSchemes);

  cfg.build.android = resolveChoiceToggle(env.INPUT_ANDROID, cfg.build.android);
  cfg.build.windows = resolveChoiceToggle(env.INPUT_WINDOWS, cfg.build.windows);
  cfg.build.macos = resolveChoiceToggle(env.INPUT_MACOS, cfg.build.macos);
  cfg.build.linux = resolveChoiceToggle(env.INPUT_LINUX, cfg.build.linux);

  const abiMode = resolveChoiceValue(env.INPUT_ANDROID_ABIS, "split-and-universal");
  const androidSplit = abiMode !== "universal-only";
  const androidUniversal = abiMode !== "split-only";

  const targets = [];
  if (cfg.build.windows) {
    targets.push(
      {
        platform: "windows-x64",
        os: "windows-latest",
        target: "x86_64-pc-windows-msvc",
        rust_targets: "x86_64-pc-windows-msvc",
        bundles: "nsis,msi"
      },
      {
        platform: "windows-arm64",
        os: "windows-latest",
        target: "aarch64-pc-windows-msvc",
        rust_targets: "aarch64-pc-windows-msvc",
        bundles: "nsis,msi"
      }
    );
  }
  if (cfg.build.macos) {
    targets.push({
      platform: "macos-universal",
      os: "macos-latest",
      target: "universal-apple-darwin",
      rust_targets: "x86_64-apple-darwin,aarch64-apple-darwin",
      bundles: "dmg,app"
    });
  }
  if (cfg.build.linux) {
    targets.push(
      {
        platform: "linux-x64",
        os: "ubuntu-22.04",
        target: "x86_64-unknown-linux-gnu",
        rust_targets: "x86_64-unknown-linux-gnu",
        bundles: "appimage,deb"
      },
      {
        platform: "linux-arm64",
        os: "ubuntu-24.04-arm",
        target: "aarch64-unknown-linux-gnu",
        rust_targets: "aarch64-unknown-linux-gnu",
        bundles: "appimage,deb"
      }
    );
  }

  return {
    config: cfg,
    plan: {
      app_name: cfg.app.name,
      version: cfg.app.version,
      package_id: cfg.app.packageId,
      android: Boolean(cfg.build.android),
      android_split: androidSplit,
      android_universal: androidUniversal,
      has_desktop: targets.length > 0,
      desktop_matrix: JSON.stringify(targets)
    }
  };
}

function main() {
  const args = new Set(process.argv.slice(2));
  const configPath = path.join(ROOT_DIR, "app.config.json");

  if (args.has("--restore")) {
    const b64 = nonEmpty(process.env.RESOLVED_CFG_B64);
    if (!b64) {
      throw new Error("RESOLVED_CFG_B64 is required when running with --restore");
    }
    const restored = Buffer.from(b64, "base64").toString("utf8");
    JSON.parse(restored);
    fs.writeFileSync(configPath, restored, "utf8");
    console.log("[ci-overrides] Restored resolved app.config.json for build job.");
    return;
  }

  const raw = JSON.parse(fs.readFileSync(configPath, "utf8"));
  const { config, plan } = applyCiOverrides(raw, process.env);
  const serialized = JSON.stringify(config, null, 2) + "\n";

  if (args.has("--write")) {
    fs.writeFileSync(configPath, serialized, "utf8");
  }

  const outFile = process.env.GITHUB_OUTPUT;
  if (outFile) {
    const lines = [
      `app_name=${plan.app_name}`,
      `version=${plan.version}`,
      `package_id=${plan.package_id}`,
      `android=${plan.android}`,
      `android_split=${plan.android_split}`,
      `android_universal=${plan.android_universal}`,
      `has_desktop=${plan.has_desktop}`,
      `desktop_matrix=${plan.desktop_matrix}`,
      `resolved_config_b64=${Buffer.from(serialized, "utf8").toString("base64")}`
    ];
    fs.appendFileSync(outFile, `${lines.join("\n")}\n`, "utf8");
  }

  console.log(
    `[ci-overrides] Target: ${plan.app_name} (${plan.package_id} v${plan.version}) | Android=${plan.android} (split=${plan.android_split}, universal=${plan.android_universal}) | Desktop=${plan.has_desktop}`
  );
}

const isEntry =
  process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename);
if (isEntry) {
  main();
}
