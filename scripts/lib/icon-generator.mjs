import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i += 1) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function makeChunk(type, data) {
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const crcBuf = Buffer.alloc(4);
  const crcInput = Buffer.concat([typeBuf, data]);
  crcBuf.writeUInt32BE(crc32(crcInput), 0);
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

function paethPredictor(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

export function decodePng(buffer) {
  if (buffer.length < 24 || !buffer.subarray(0, 8).equals(PNG_SIG)) {
    throw new Error("Invalid PNG signature.");
  }

  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  let interlace = 0;
  const idatChunks = [];
  let palette = null;
  let trns = null;

  while (offset + 12 <= buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.subarray(offset + 4, offset + 8).toString("ascii");
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    const data = buffer.subarray(dataStart, dataEnd);

    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
      interlace = data[12];
      if (bitDepth !== 8) {
        throw new Error(`Unsupported PNG bit depth: ${bitDepth}. Expected 8.`);
      }
      if (interlace !== 0) {
        throw new Error("Interlaced PNGs are not supported. Save icon.png as non-interlaced.");
      }
    } else if (type === "PLTE") {
      palette = data;
    } else if (type === "tRNS") {
      trns = data;
    } else if (type === "IDAT") {
      idatChunks.push(data);
    } else if (type === "IEND") {
      break;
    }

    offset = dataEnd + 4;
  }

  const channelsMap = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };
  const bpp = channelsMap[colorType];
  if (!bpp) {
    throw new Error(`Unsupported PNG color type: ${colorType}`);
  }

  const inflated = zlib.inflateSync(Buffer.concat(idatChunks));
  const stride = width * bpp;
  const raw = Buffer.alloc(height * stride);

  for (let y = 0; y < height; y += 1) {
    const filterType = inflated[y * (stride + 1)];
    const rowInStart = y * (stride + 1) + 1;
    const rowOutStart = y * stride;

    for (let x = 0; x < stride; x += 1) {
      const rawByte = inflated[rowInStart + x];
      const left = x >= bpp ? raw[rowOutStart + x - bpp] : 0;
      const up = y > 0 ? raw[(y - 1) * stride + x] : 0;
      const upLeft = y > 0 && x >= bpp ? raw[(y - 1) * stride + x - bpp] : 0;

      let recon = rawByte;
      if (filterType === 1) recon = (rawByte + left) & 0xff;
      else if (filterType === 2) recon = (rawByte + up) & 0xff;
      else if (filterType === 3) recon = (rawByte + ((left + up) >> 1)) & 0xff;
      else if (filterType === 4) recon = (rawByte + paethPredictor(left, up, upLeft)) & 0xff;
      raw[rowOutStart + x] = recon;
    }
  }

  const rgba = Buffer.alloc(width * height * 4);
  for (let i = 0; i < width * height; i += 1) {
    const outIdx = i * 4;
    if (colorType === 6) {
      const inIdx = i * 4;
      rgba[outIdx] = raw[inIdx];
      rgba[outIdx + 1] = raw[inIdx + 1];
      rgba[outIdx + 2] = raw[inIdx + 2];
      rgba[outIdx + 3] = raw[inIdx + 3];
    } else if (colorType === 2) {
      const inIdx = i * 3;
      rgba[outIdx] = raw[inIdx];
      rgba[outIdx + 1] = raw[inIdx + 1];
      rgba[outIdx + 2] = raw[inIdx + 2];
      rgba[outIdx + 3] = 255;
    } else if (colorType === 0) {
      const g = raw[i];
      rgba[outIdx] = g;
      rgba[outIdx + 1] = g;
      rgba[outIdx + 2] = g;
      rgba[outIdx + 3] = 255;
    } else if (colorType === 4) {
      const inIdx = i * 2;
      const g = raw[inIdx];
      rgba[outIdx] = g;
      rgba[outIdx + 1] = g;
      rgba[outIdx + 2] = g;
      rgba[outIdx + 3] = raw[inIdx + 1];
    } else if (colorType === 3 && palette) {
      const idx = raw[i];
      const pIdx = idx * 3;
      rgba[outIdx] = palette[pIdx] || 0;
      rgba[outIdx + 1] = palette[pIdx + 1] || 0;
      rgba[outIdx + 2] = palette[pIdx + 2] || 0;
      rgba[outIdx + 3] = trns && idx < trns.length ? trns[idx] : 255;
    }
  }

  return { width, height, rgba };
}

export function encodePng(width, height, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  const stride = width * 4;
  const filtered = Buffer.alloc(height * (stride + 1));
  for (let y = 0; y < height; y += 1) {
    const dstRow = y * (stride + 1);
    filtered[dstRow] = 0; // filter type None
    rgba.copy(filtered, dstRow + 1, y * stride, (y + 1) * stride);
  }

  const compressed = zlib.deflateSync(filtered, { level: 6 });
  return Buffer.concat([
    PNG_SIG,
    makeChunk("IHDR", ihdr),
    makeChunk("IDAT", compressed),
    makeChunk("IEND", Buffer.alloc(0))
  ]);
}

export function resizeRgba(src, srcW, srcH, dstW, dstH) {
  if (srcW === dstW && srcH === dstH) {
    return Buffer.from(src);
  }

  const dst = Buffer.alloc(dstW * dstH * 4);
  const scaleX = srcW / dstW;
  const scaleY = srcH / dstH;

  // Box-averaged area sampling for crisp downscaling without aliasing
  for (let dy = 0; dy < dstH; dy += 1) {
    const sy0 = dy * scaleY;
    const sy1 = (dy + 1) * scaleY;
    const iy0 = Math.floor(sy0);
    const iy1 = Math.min(srcH - 1, Math.floor(sy1));

    for (let dx = 0; dx < dstW; dx += 1) {
      const sx0 = dx * scaleX;
      const sx1 = (dx + 1) * scaleX;
      const ix0 = Math.floor(sx0);
      const ix1 = Math.min(srcW - 1, Math.floor(sx1));

      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      let weightSum = 0;

      for (let sy = iy0; sy <= iy1; sy += 1) {
        const wy = Math.min(sy + 1, sy1) - Math.max(sy, sy0);
        if (wy <= 0) continue;
        for (let sx = ix0; sx <= ix1; sx += 1) {
          const wx = Math.min(sx + 1, sx1) - Math.max(sx, sx0);
          if (wx <= 0) continue;
          const w = wx * wy;
          const idx = (sy * srcW + sx) * 4;
          const alpha = src[idx + 3] / 255;
          r += src[idx] * alpha * w;
          g += src[idx + 1] * alpha * w;
          b += src[idx + 2] * alpha * w;
          a += src[idx + 3] * w;
          weightSum += w;
        }
      }

      const outIdx = (dy * dstW + dx) * 4;
      const avgA = weightSum > 0 ? a / weightSum : 0;
      if (avgA > 0.001) {
        const alphaNorm = avgA / 255;
        dst[outIdx] = Math.min(255, Math.round(r / weightSum / alphaNorm));
        dst[outIdx + 1] = Math.min(255, Math.round(g / weightSum / alphaNorm));
        dst[outIdx + 2] = Math.min(255, Math.round(b / weightSum / alphaNorm));
        dst[outIdx + 3] = Math.min(255, Math.round(avgA));
      }
    }
  }

  return dst;
}

function encodeIcoBmpFrame(size, rgba) {
  const headerSize = 40;
  const xorSize = size * size * 4;
  const andRowStride = Math.ceil(size / 32) * 4;
  const andSize = andRowStride * size;
  const buf = Buffer.alloc(headerSize + xorSize + andSize);

  buf.writeUInt32LE(headerSize, 0);
  buf.writeInt32LE(size, 4);
  buf.writeInt32LE(size * 2, 8); // Combined height of XOR + AND masks
  buf.writeUInt16LE(1, 12); // Planes
  buf.writeUInt16LE(32, 14); // 32-bit BGRA
  buf.writeUInt32LE(0, 16); // BI_RGB
  buf.writeUInt32LE(xorSize, 20);

  let xorOffset = headerSize;
  for (let y = size - 1; y >= 0; y -= 1) {
    for (let x = 0; x < size; x += 1) {
      const srcIdx = (y * size + x) * 4;
      buf[xorOffset] = rgba[srcIdx + 2]; // B
      buf[xorOffset + 1] = rgba[srcIdx + 1]; // G
      buf[xorOffset + 2] = rgba[srcIdx]; // R
      buf[xorOffset + 3] = rgba[srcIdx + 3]; // A
      xorOffset += 4;
    }
  }

  const andBase = headerSize + xorSize;
  for (let y = size - 1; y >= 0; y -= 1) {
    const dstRow = andBase + (size - 1 - y) * andRowStride;
    for (let x = 0; x < size; x += 1) {
      const alpha = rgba[(y * size + x) * 4 + 3];
      if (alpha < 128) {
        const byteIdx = dstRow + (x >> 3);
        buf[byteIdx] |= 1 << (7 - (x & 7));
      }
    }
  }

  return buf;
}

function createIco(entries) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: 1 = ICO
  header.writeUInt16LE(entries.length, 4);

  const dirSize = entries.length * 16;
  let dataOffset = 6 + dirSize;
  const dirBuffers = [];
  const imageBuffers = [];

  for (const { size, payload } of entries) {
    const dir = Buffer.alloc(16);
    dir[0] = size >= 256 ? 0 : size;
    dir[1] = size >= 256 ? 0 : size;
    dir[2] = 0; // palette count
    dir[3] = 0; // reserved
    dir.writeUInt16LE(1, 4); // color planes
    dir.writeUInt16LE(32, 6); // bits per pixel
    dir.writeUInt32LE(payload.length, 8);
    dir.writeUInt32LE(dataOffset, 12);
    dirBuffers.push(dir);
    imageBuffers.push(payload);
    dataOffset += payload.length;
  }

  return Buffer.concat([header, ...dirBuffers, ...imageBuffers]);
}

function createIcns(chunks) {
  const body = [];
  let totalLength = 8;

  for (const { type, png } of chunks) {
    const chunkHeader = Buffer.alloc(8);
    chunkHeader.write(type, 0, 4, "ascii");
    chunkHeader.writeUInt32BE(png.length + 8, 4);
    body.push(chunkHeader, png);
    totalLength += png.length + 8;
  }

  const header = Buffer.alloc(8);
  header.write("icns", 0, 4, "ascii");
  header.writeUInt32BE(totalLength, 4);
  return Buffer.concat([header, ...body]);
}

function writePngVariant(src, targetPath, size) {
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  const resized = resizeRgba(src.rgba, src.width, src.height, size, size);
  const png = encodePng(size, size, resized);
  fs.writeFileSync(targetPath, png);
  return png;
}

export function generateIcons({ rootDir, iconPath, androidOnly = false }) {
  const masterBuffer = fs.readFileSync(iconPath);
  const master = decodePng(masterBuffer);

  if (!androidOnly) {
    const tauriIconsDir = path.join(rootDir, "src-tauri", "icons");
    fs.mkdirSync(tauriIconsDir, { recursive: true });

    const png32 = writePngVariant(master, path.join(tauriIconsDir, "32x32.png"), 32);
    const png128 = writePngVariant(master, path.join(tauriIconsDir, "128x128.png"), 128);
    const png256 = writePngVariant(master, path.join(tauriIconsDir, "128x128@2x.png"), 256);
    const png512 = writePngVariant(master, path.join(tauriIconsDir, "icon.png"), 512);
    const png1024 = encodePng(
      1024,
      1024,
      resizeRgba(master.rgba, master.width, master.height, 1024, 1024)
    );

    const rgba16 = resizeRgba(master.rgba, master.width, master.height, 16, 16);
    const rgba24 = resizeRgba(master.rgba, master.width, master.height, 24, 24);
    const rgba32 = resizeRgba(master.rgba, master.width, master.height, 32, 32);
    const rgba48 = resizeRgba(master.rgba, master.width, master.height, 48, 48);
    const rgba64 = resizeRgba(master.rgba, master.width, master.height, 64, 64);
    const rgba128 = resizeRgba(master.rgba, master.width, master.height, 128, 128);

    const icoBuf = createIco([
      { size: 16, payload: encodeIcoBmpFrame(16, rgba16) },
      { size: 24, payload: encodeIcoBmpFrame(24, rgba24) },
      { size: 32, payload: encodeIcoBmpFrame(32, rgba32) },
      { size: 48, payload: encodeIcoBmpFrame(48, rgba48) },
      { size: 64, payload: encodeIcoBmpFrame(64, rgba64) },
      { size: 128, payload: encodeIcoBmpFrame(128, rgba128) },
      { size: 256, payload: png256 }
    ]);
    fs.writeFileSync(path.join(tauriIconsDir, "icon.ico"), icoBuf);

    const icnsBuf = createIcns([
      { type: "ic07", png: png128 },
      { type: "ic08", png: png256 },
      { type: "ic09", png: png512 },
      { type: "ic10", png: png1024 }
    ]);
    fs.writeFileSync(path.join(tauriIconsDir, "icon.icns"), icnsBuf);

    const storeSizes = [
      ["Square30x30Logo.png", 30],
      ["Square44x44Logo.png", 44],
      ["Square71x71Logo.png", 71],
      ["Square89x89Logo.png", 89],
      ["Square107x107Logo.png", 107],
      ["Square142x142Logo.png", 142],
      ["Square150x150Logo.png", 150],
      ["Square284x284Logo.png", 284],
      ["Square310x310Logo.png", 310],
      ["StoreLogo.png", 50]
    ];
    for (const [filename, size] of storeSizes) {
      writePngVariant(master, path.join(tauriIconsDir, filename), size);
    }

    // If @tauri-apps/cli is installed, also run `tauri icon` for native desktop icon parity.
    const tauriCliBin = path.join(
      rootDir,
      "node_modules",
      ".bin",
      process.platform === "win32" ? "tauri.cmd" : "tauri"
    );
    if (fs.existsSync(tauriCliBin)) {
      try {
        execFileSync(tauriCliBin, ["icon", iconPath, "-o", tauriIconsDir], {
          cwd: rootDir,
          stdio: "pipe",
          shell: process.platform === "win32"
        });
      } catch {
        // Fallback BMP+PNG icons generated above remain intact.
      }
    }
  }

  const androidDensities = [
    ["mipmap-mdpi", 48],
    ["mipmap-hdpi", 72],
    ["mipmap-xhdpi", 96],
    ["mipmap-xxhdpi", 144],
    ["mipmap-xxxhdpi", 192]
  ];

  const androidTargets = [path.join(rootDir, "android-template", "res")];
  const generatedAndroidRes = path.join(
    rootDir,
    "src-tauri",
    "gen",
    "android",
    "app",
    "src",
    "main",
    "res"
  );
  if (fs.existsSync(path.join(rootDir, "src-tauri", "gen", "android"))) {
    androidTargets.push(generatedAndroidRes);
  }

  for (const resRoot of androidTargets) {
    for (const [folder, size] of androidDensities) {
      const dir = path.join(resRoot, folder);
      writePngVariant(master, path.join(dir, "ic_launcher.png"), size);
      writePngVariant(master, path.join(dir, "ic_launcher_round.png"), size);
      writePngVariant(master, path.join(dir, "ic_launcher_foreground.png"), size);
    }
  }
}
