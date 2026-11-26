import fs from "node:fs";
import path from "node:path";

function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function semverToVersionCode(version) {
  const core = version.split("-")[0];
  const parts = core.split(".").map((n) => Number.parseInt(n, 10) || 0);
  const major = parts[0] || 0;
  const minor = parts[1] || 0;
  const patch = parts[2] || 0;
  return Math.max(1, major * 10000 + minor * 100 + patch);
}

function copyDirRecursive(srcDir, dstDir) {
  if (!fs.existsSync(srcDir)) return;
  fs.mkdirSync(dstDir, { recursive: true });
  for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
    const srcPath = path.join(srcDir, entry.name);
    const dstPath = path.join(dstDir, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, dstPath);
    } else {
      fs.copyFileSync(srcPath, dstPath);
    }
  }
}

export function patchAndroid({ rootDir, config }) {
  const packageId = config.app.packageId;
  const versionName = config.app.version;
  const versionCode = semverToVersionCode(versionName);
  const appName = config.app.name;

  const templateDir = path.join(rootDir, "android-template");
  const valuesDir = path.join(templateDir, "res", "values");
  fs.mkdirSync(valuesDir, { recursive: true });

  const stringsXml = `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <string name="app_name">${escapeXml(appName)}</string>
    <string name="main_activity_title">${escapeXml(appName)}</string>
</resources>
`;
  fs.writeFileSync(path.join(valuesDir, "strings.xml"), stringsXml, "utf8");

  // Keep android-template/build.gradle.kts synced with configured identifiers
  const templateGradlePath = path.join(templateDir, "build.gradle.kts");
  if (fs.existsSync(templateGradlePath)) {
    let gradle = fs.readFileSync(templateGradlePath, "utf8");
    gradle = gradle.replace(/namespace\s*=\s*"[^"]*"/, `namespace = "${packageId}"`);
    gradle = gradle.replace(/applicationId\s*=\s*"[^"]*"/, `applicationId = "${packageId}"`);
    gradle = gradle.replace(/versionCode\s*=\s*\d+/, `versionCode = ${versionCode}`);
    gradle = gradle.replace(/versionName\s*=\s*"[^"]*"/, `versionName = "${versionName}"`);
    fs.writeFileSync(templateGradlePath, gradle, "utf8");
  }

  // If tauri android init has generated src-tauri/gen/android, apply full overrides
  const genAndroidDir = path.join(rootDir, "src-tauri", "gen", "android");
  if (!fs.existsSync(genAndroidDir)) {
    return;
  }

  const genAppDir = path.join(genAndroidDir, "app");
  const genMainDir = path.join(genAppDir, "src", "main");

  // 1. Copy AndroidManifest.xml with packageId placeholder resolved
  const manifestSrc = fs.readFileSync(path.join(templateDir, "AndroidManifest.xml"), "utf8");
  const manifestOut = manifestSrc.replace(/__PACKAGE_ID__/g, packageId);
  fs.writeFileSync(path.join(genMainDir, "AndroidManifest.xml"), manifestOut, "utf8");

  // 2. Copy build.gradle.kts override
  fs.copyFileSync(templateGradlePath, path.join(genAppDir, "build.gradle.kts"));

  // 3. Copy modular Kotlin wrapper classes
  const wrapperSrc = path.join(templateDir, "kotlin", "com", "url2native", "wrapper");
  const wrapperDst = path.join(genMainDir, "kotlin", "com", "url2native", "wrapper");
  copyDirRecursive(wrapperSrc, wrapperDst);

  // 4. Generate entry MainActivity.kt in configured packageId and remove duplicate generated stub
  const packageSegments = packageId.split(".");
  const javaPkgDir = path.join(genMainDir, "java", ...packageSegments);
  const kotlinPkgDir = path.join(genMainDir, "kotlin", ...packageSegments);

  if (fs.existsSync(path.join(javaPkgDir, "MainActivity.kt"))) {
    fs.unlinkSync(path.join(javaPkgDir, "MainActivity.kt"));
  }

  if (packageId !== "com.url2native.wrapper") {
    fs.mkdirSync(kotlinPkgDir, { recursive: true });
    const entryActivity = `package ${packageId}

class MainActivity : com.url2native.wrapper.MainActivity()
`;
    fs.writeFileSync(path.join(kotlinPkgDir, "MainActivity.kt"), entryActivity, "utf8");
  }

  // 5. Copy resources (strings.xml + mipmap-* icons) and assets (offline.html, app.config.json)
  copyDirRecursive(path.join(templateDir, "res"), path.join(genMainDir, "res"));
  copyDirRecursive(path.join(templateDir, "assets"), path.join(genMainDir, "assets"));
}
