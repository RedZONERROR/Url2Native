#!/usr/bin/env node

import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { validateConfig } from "./lib/validator.mjs";
import { generateIcons } from "./lib/icon-generator.mjs";
import { generateUi } from "./lib/generate-ui.mjs";
import { patchTauri } from "./lib/patch-tauri.mjs";
import { patchAndroid } from "./lib/patch-android.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..");

function parseArgs(argv) {
  const args = {
    configPath: path.join(ROOT_DIR, "app.config.json"),
    schemaPath: path.join(ROOT_DIR, "schema", "app.config.schema.json"),
    checkOnly: false,
    skipIcons: false,
    androidOnly: false
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--config" && argv[i + 1]) {
      args.configPath = path.resolve(ROOT_DIR, argv[i + 1]);
      i += 1;
    } else if (token === "--check-only") {
      args.checkOnly = true;
    } else if (token === "--skip-icons") {
      args.skipIcons = true;
    } else if (token === "--android-only") {
      args.androidOnly = true;
    } else if (token === "--help" || token === "-h") {
      console.log(
        [
          "Usage: node scripts/configure.mjs [options]",
          "",
          "Options:",
          "  --config <path>   Path to app.config.json (default: app.config.json)",
          "  --check-only      Validate config and icon without writing generated files",
          "  --skip-icons      Skip icon generation",
          "  --android-only    Patch Android template and generated Android project only",
          "  -h, --help        Show this help message"
        ].join("\n")
      );
      process.exit(0);
    } else {
      throw new Error(`Unknown CLI argument: ${token}`);
    }
  }

  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  console.log("[configure] Validating configuration...");
  const { config, iconInfo } = validateConfig({
    rootDir: ROOT_DIR,
    configPath: args.configPath,
    schemaPath: args.schemaPath
  });

  console.log(
    `[configure] Valid config for "${config.app.name}" (${config.app.packageId} v${config.app.version})`
  );
  console.log(
    `[configure] Master icon verified: ${iconInfo.width}x${iconInfo.height} PNG`
  );

  if (args.checkOnly) {
    console.log("[configure] Check-only mode complete. No files modified.");
    return;
  }

  console.log("[configure] Generating UI assets and runtime config...");
  generateUi({ rootDir: ROOT_DIR, config });

  if (!args.androidOnly) {
    console.log("[configure] Patching Tauri configuration and Cargo metadata...");
    patchTauri({ rootDir: ROOT_DIR, config });
  }

  if (!args.skipIcons) {
    console.log("[configure] Generating platform icons...");
    generateIcons({
      rootDir: ROOT_DIR,
      iconPath: iconInfo.absolutePath,
      androidOnly: args.androidOnly
    });
  }

  console.log("[configure] Patching Android configuration and native overrides...");
  patchAndroid({ rootDir: ROOT_DIR, config });

  console.log("[configure] Pre-build configuration pipeline finished successfully.");
}

main().catch((error) => {
  console.error(`[configure] ERROR: ${error.message}`);
  process.exit(1);
});
