import fs from "node:fs";
import path from "node:path";

export function patchTauri({ rootDir, config }) {
  const tauriConfPath = path.join(rootDir, "src-tauri", "tauri.conf.json");
  const tauriConf = JSON.parse(fs.readFileSync(tauriConfPath, "utf8"));

  tauriConf.productName = config.app.name;
  tauriConf.version = config.app.version;
  tauriConf.identifier = config.app.packageId;

  if (tauriConf.app && Array.isArray(tauriConf.app.windows) && tauriConf.app.windows.length > 0) {
    tauriConf.app.windows[0].title = config.app.name;
  }

  fs.writeFileSync(tauriConfPath, JSON.stringify(tauriConf, null, 2) + "\n", "utf8");

  const cargoPath = path.join(rootDir, "src-tauri", "Cargo.toml");
  let cargoToml = fs.readFileSync(cargoPath, "utf8");
  const safeDescription = config.app.name.replace(/"/g, '\\"');
  cargoToml = cargoToml.replace(
    /^version\s*=\s*"[^"]*"/m,
    `version = "${config.app.version}"`
  );
  cargoToml = cargoToml.replace(
    /^description\s*=\s*"[^"]*"/m,
    `description = "Native wrapper for ${safeDescription}"`
  );
  fs.writeFileSync(cargoPath, cargoToml, "utf8");
}
