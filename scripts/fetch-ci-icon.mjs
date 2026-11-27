#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { decodePng, encodePng, resizeRgba } from "./lib/icon-generator.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..");

const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const MAX_BYTES = 15 * 1024 * 1024;
const TARGET_SIZE = 1024;

function isDisallowedHost(hostname) {
  const host = hostname.toLowerCase();
  if (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "0.0.0.0" ||
    host === "::1" ||
    host.endsWith(".local") ||
    host.endsWith(".internal")
  ) {
    return true;
  }
  if (/^10\./.test(host) || /^192\.168\./.test(host) || /^169\.254\./.test(host)) {
    return true;
  }
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(host)) {
    return true;
  }
  return false;
}

export function validateIconUrl(rawUrl) {
  const parsed = new URL(rawUrl);
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(`app_icon_url must start with http:// or https:// (got ${parsed.protocol})`);
  }
  if (isDisallowedHost(parsed.hostname)) {
    throw new Error(`Disallowed private/local host in app_icon_url: ${parsed.hostname}`);
  }
  return parsed.toString();
}

function padOrCropSquareRgba(width, height, rgba) {
  if (width === height) {
    return { size: width, rgba };
  }
  const size = Math.max(width, height);
  const canvas = Buffer.alloc(size * size * 4);
  const offsetX = Math.floor((size - width) / 2);
  const offsetY = Math.floor((size - height) / 2);

  for (let y = 0; y < height; y += 1) {
    const srcStart = y * width * 4;
    const dstStart = ((y + offsetY) * size + offsetX) * 4;
    rgba.copy(canvas, dstStart, srcStart, srcStart + width * 4);
  }
  return { size, rgba: canvas };
}

function normalizePngBuffer(buffer) {
  const decoded = decodePng(buffer);
  const square = padOrCropSquareRgba(decoded.width, decoded.height, decoded.rgba);
  const resized = resizeRgba(square.rgba, square.size, square.size, TARGET_SIZE, TARGET_SIZE);
  return encodePng(TARGET_SIZE, TARGET_SIZE, resized);
}

function convertViaSystemTool(rawBuffer) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "u2n-icon-"));
  const inFile = path.join(tmpDir, "source.img");
  const outFile = path.join(tmpDir, "icon.png");
  try {
    fs.writeFileSync(inFile, rawBuffer);
    const magickArgs = [
      inFile,
      "-background",
      "none",
      "-gravity",
      "center",
      "-resize",
      `${TARGET_SIZE}x${TARGET_SIZE}`,
      "-extent",
      `${TARGET_SIZE}x${TARGET_SIZE}`,
      "-depth",
      "8",
      "-define",
      "png:color-type=6",
      `PNG32:${outFile}`
    ];

    const attempts = [
      ["magick", magickArgs],
      ["convert", magickArgs],
      [
        "ffmpeg",
        [
          "-y",
          "-i",
          inFile,
          "-vf",
          `scale=${TARGET_SIZE}:${TARGET_SIZE}:force_original_aspect_ratio=decrease,pad=${TARGET_SIZE}:${TARGET_SIZE}:(ow-iw)/2:(oh-ih)/2:color=0x00000000`,
          "-frames:v",
          "1",
          outFile
        ]
      ]
    ];

    let lastErr = null;
    for (const [cmd, args] of attempts) {
      try {
        execFileSync(cmd, args, { stdio: "pipe", timeout: 20000 });
        if (fs.existsSync(outFile) && fs.statSync(outFile).size > 0) {
          const outBuf = fs.readFileSync(outFile);
          return normalizePngBuffer(outBuf);
        }
      } catch (err) {
        lastErr = err;
      }
    }
    throw new Error(
      `Downloaded icon is not an 8-bit non-interlaced PNG and no converter (ImageMagick/ffmpeg) succeeded: ${
        lastErr?.message || "unknown error"
      }`
    );
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

export function normalizeIconBufferTo1024Png(rawBuffer) {
  if (rawBuffer.length >= 24 && rawBuffer.subarray(0, 8).equals(PNG_SIG)) {
    try {
      return normalizePngBuffer(rawBuffer);
    } catch {
      // Fall through to system image converter for interlaced/16-bit PNGs
    }
  }
  return convertViaSystemTool(rawBuffer);
}

function appendGithubOutput(key, value) {
  const outFile = process.env.GITHUB_OUTPUT;
  if (outFile) {
    fs.appendFileSync(outFile, `${key}=${value}\n`, "utf8");
  }
}

async function downloadIcon(url) {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(20000),
    redirect: "follow",
    headers: {
      "User-Agent": "Url2Native-CI-IconFetcher/1.0"
    }
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch app_icon_url (${res.status} ${res.statusText})`);
  }
  const lenHeader = Number.parseInt(res.headers.get("content-length") || "0", 10);
  if (lenHeader > MAX_BYTES) {
    throw new Error(`app_icon_url exceeds ${MAX_BYTES} byte limit (${lenHeader} bytes)`);
  }
  const arrayBuf = await res.arrayBuffer();
  const buf = Buffer.from(arrayBuf);
  if (buf.length === 0 || buf.length > MAX_BYTES) {
    throw new Error(`Downloaded icon size is invalid (${buf.length} bytes)`);
  }
  return buf;
}

async function main() {
  const rawUrl = String(process.env.INPUT_APP_ICON_URL ?? "").trim();
  const configPath = path.join(ROOT_DIR, "app.config.json");
  const cfg = JSON.parse(fs.readFileSync(configPath, "utf8"));
  const relIcon = String(cfg.app?.icon || "icon.png").replace(/\\/g, "/");
  const destPath = path.resolve(ROOT_DIR, relIcon);
  if (!destPath.startsWith(ROOT_DIR)) {
    throw new Error(`Unsafe icon path outside workspace: ${relIcon}`);
  }

  if (!rawUrl) {
    console.log(`[ci-icon] No app_icon_url provided; using fallback repository icon (${relIcon}).`);
    appendGithubOutput("custom_icon", "false");
    appendGithubOutput("icon_path", relIcon);
    return;
  }

  const safeUrl = validateIconUrl(rawUrl);
  console.log(`[ci-icon] Downloading custom icon from ${safeUrl}...`);
  const downloaded = await downloadIcon(safeUrl);
  const png1024 = normalizeIconBufferTo1024Png(downloaded);

  fs.mkdirSync(path.dirname(destPath), { recursive: true });
  fs.writeFileSync(destPath, png1024);
  console.log(`[ci-icon] Converted custom icon to ${TARGET_SIZE}x${TARGET_SIZE} PNG at ${relIcon}.`);
  appendGithubOutput("custom_icon", "true");
  appendGithubOutput("icon_path", relIcon);
}

const isEntry =
  process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename);
if (isEntry) {
  main().catch((err) => {
    console.error(`[ci-icon] ERROR: ${err.message}`);
    process.exit(1);
  });
}
