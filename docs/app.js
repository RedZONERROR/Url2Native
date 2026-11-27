const DEFAULT_CONFIG = {
  app: {
    name: "Url2Native App",
    packageId: "com.redzonerror.url2native",
    version: "1.0.0",
    url: "https://example.com",
    icon: "icon.png"
  },
  userAgent: {
    mode: "append",
    value: "Url2Native/1.0"
  },
  behavior: {
    pullToRefresh: true,
    smartCache: true,
    hardwareAcceleration: true,
    preventBrightnessDrop: true,
    externalSchemes: [
      "whatsapp",
      "upi",
      "tez",
      "phonepe",
      "paytmmp",
      "tel",
      "mailto",
      "sms",
      "geo",
      "intent"
    ],
    keepExternalDomainsInApp: false,
    allowedDomains: []
  },
  navigation: {
    enabled: false,
    position: "bottom",
    backgroundColor: "#111827",
    iconColor: "#FFFFFF",
    buttons: [
      { label: "Back", action: "back" },
      { label: "Forward", action: "forward" },
      { label: "Home", action: "home" },
      { label: "Reload", action: "reload" }
    ]
  },
  errorScreen: {
    title: "Connection Unavailable",
    message: "Unable to reach the server. Please check your internet connection and try again.",
    retryButtonText: "Retry Connection",
    accentColor: "#2563EB",
    backgroundColor: "#FFFFFF",
    textColor: "#111827"
  },
  build: {
    android: true,
    windows: true,
    macos: true,
    linux: true
  }
};

const RESERVED_JAVA_KEYWORDS = new Set([
  "abstract", "assert", "boolean", "break", "byte", "case", "catch", "char",
  "class", "const", "continue", "default", "do", "double", "else", "enum",
  "extends", "final", "finally", "float", "for", "goto", "if", "implements",
  "import", "instanceof", "int", "interface", "long", "native", "new",
  "package", "private", "protected", "public", "return", "short", "static",
  "strictfp", "super", "switch", "synchronized", "this", "throw", "throws",
  "transient", "try", "void", "volatile", "while"
]);

const PACKAGE_RE = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/;
const SEMVER_RE = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?$/;
const HEX_RE = /^#[0-9A-Fa-f]{6}$/;
const SCHEME_RE = /^[a-z][a-z0-9+.-]*$/;

let navButtonsState = structuredClone(DEFAULT_CONFIG.navigation.buttons);
let loadedImage = null;

function byId(id) {
  return document.getElementById(id);
}

function parseList(raw) {
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function bindColorPair(textId, pickerId) {
  const textInput = byId(textId);
  const pickerInput = byId(pickerId);

  pickerInput.addEventListener("input", () => {
    textInput.value = pickerInput.value.toUpperCase();
    refreshAll();
  });

  textInput.addEventListener("input", () => {
    if (HEX_RE.test(textInput.value.trim())) {
      pickerInput.value = textInput.value.trim();
    }
    refreshAll();
  });
}

function renderNavButtons() {
  const container = byId("nav-buttons-list");
  container.textContent = "";

  navButtonsState.forEach((btnItem, index) => {
    const row = document.createElement("div");
    row.className = "nav-row";

    const labelInput = document.createElement("input");
    labelInput.type = "text";
    labelInput.maxLength = 24;
    labelInput.placeholder = "Label";
    labelInput.value = btnItem.label || "";
    labelInput.addEventListener("input", () => {
      navButtonsState[index].label = labelInput.value;
      refreshAll();
    });

    const kindSelect = document.createElement("select");
    const optAction = document.createElement("option");
    optAction.value = "action";
    optAction.textContent = "Action";
    const optUrl = document.createElement("option");
    optUrl.value = "url";
    optUrl.textContent = "Custom URL";
    kindSelect.appendChild(optAction);
    kindSelect.appendChild(optUrl);

    const isUrl = Boolean(btnItem.url);
    kindSelect.value = isUrl ? "url" : "action";

    let valueControl;
    if (isUrl) {
      const urlInput = document.createElement("input");
      urlInput.type = "url";
      urlInput.placeholder = "https://example.com/help";
      urlInput.value = btnItem.url || "";
      urlInput.addEventListener("input", () => {
        navButtonsState[index].url = urlInput.value;
        refreshAll();
      });
      valueControl = urlInput;
    } else {
      const actionSelect = document.createElement("select");
      ["back", "forward", "home", "reload"].forEach((act) => {
        const opt = document.createElement("option");
        opt.value = act;
        opt.textContent = act;
        actionSelect.appendChild(opt);
      });
      actionSelect.value = btnItem.action || "back";
      actionSelect.addEventListener("change", () => {
        navButtonsState[index].action = actionSelect.value;
        refreshAll();
      });
      valueControl = actionSelect;
    }

    kindSelect.addEventListener("change", () => {
      if (kindSelect.value === "url") {
        navButtonsState[index] = {
          label: navButtonsState[index].label || "Link",
          url: "https://example.com"
        };
      } else {
        navButtonsState[index] = {
          label: navButtonsState[index].label || "Home",
          action: "home"
        };
      }
      renderNavButtons();
      refreshAll();
    });

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "btn btn-danger";
    removeBtn.textContent = "Remove";
    removeBtn.addEventListener("click", () => {
      navButtonsState.splice(index, 1);
      renderNavButtons();
      refreshAll();
    });

    row.appendChild(labelInput);
    row.appendChild(kindSelect);
    row.appendChild(valueControl);
    row.appendChild(removeBtn);
    container.appendChild(row);
  });

  byId("add-nav-btn").disabled = navButtonsState.length >= 8;
}

function readConfigFromForm() {
  return {
    app: {
      name: byId("app-name").value.trim(),
      packageId: byId("app-packageId").value.trim(),
      version: byId("app-version").value.trim(),
      url: byId("app-url").value.trim(),
      icon: byId("app-icon-path").value.trim() || "icon.png"
    },
    userAgent: {
      mode: byId("ua-mode").value,
      value: byId("ua-value").value
    },
    behavior: {
      pullToRefresh: byId("beh-pullToRefresh").checked,
      smartCache: byId("beh-smartCache").checked,
      hardwareAcceleration: byId("beh-hardwareAcceleration").checked,
      preventBrightnessDrop: byId("beh-preventBrightnessDrop").checked,
      externalSchemes: parseList(byId("beh-externalSchemes").value),
      keepExternalDomainsInApp: byId("beh-keepExternalDomainsInApp").checked,
      allowedDomains: parseList(byId("beh-allowedDomains").value)
    },
    navigation: {
      enabled: byId("nav-enabled").checked,
      position: byId("nav-position").value,
      backgroundColor: byId("nav-backgroundColor").value.trim(),
      iconColor: byId("nav-iconColor").value.trim(),
      buttons: navButtonsState.map((b) =>
        b.url
          ? { label: (b.label || "").trim(), url: b.url.trim() }
          : { label: (b.label || "").trim(), action: b.action || "back" }
      )
    },
    errorScreen: {
      title: byId("err-title").value.trim(),
      message: byId("err-message").value.trim(),
      retryButtonText: byId("err-retryButtonText").value.trim(),
      accentColor: byId("err-accentColor").value.trim(),
      backgroundColor: byId("err-backgroundColor").value.trim(),
      textColor: byId("err-textColor").value.trim()
    },
    build: {
      android: byId("bld-android").checked,
      windows: byId("bld-windows").checked,
      macos: byId("bld-macos").checked,
      linux: byId("bld-linux").checked
    }
  };
}

function validateConfigObject(cfg) {
  const errors = [];

  if (!cfg.app.name || cfg.app.name.length > 64) {
    errors.push("app.name must be 1-64 characters.");
  }
  if (!PACKAGE_RE.test(cfg.app.packageId)) {
    errors.push("app.packageId must be reverse-domain lowercase (e.g. com.example.app).");
  } else {
    for (const seg of cfg.app.packageId.split(".")) {
      if (RESERVED_JAVA_KEYWORDS.has(seg)) {
        errors.push(`app.packageId contains reserved Java keyword "${seg}".`);
      }
    }
  }
  if (!SEMVER_RE.test(cfg.app.version)) {
    errors.push("app.version must be valid SemVer (e.g. 1.0.0).");
  }
  try {
    const parsedUrl = new URL(cfg.app.url);
    if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
      errors.push("app.url must start with http:// or https://.");
    }
  } catch {
    errors.push("app.url is not a valid URL.");
  }
  if (!cfg.app.icon.endsWith(".png")) {
    errors.push("app.icon must end with .png.");
  }

  for (const scheme of cfg.behavior.externalSchemes) {
    if (!SCHEME_RE.test(scheme)) {
      errors.push(`Invalid external scheme "${scheme}".`);
    }
  }

  if (!HEX_RE.test(cfg.navigation.backgroundColor)) {
    errors.push("navigation.backgroundColor must be #RRGGBB.");
  }
  if (!HEX_RE.test(cfg.navigation.iconColor)) {
    errors.push("navigation.iconColor must be #RRGGBB.");
  }
  cfg.navigation.buttons.forEach((b, idx) => {
    if (!b.label || b.label.length > 24) {
      errors.push(`navigation.buttons[${idx}].label must be 1-24 characters.`);
    }
    if (b.url !== undefined) {
      try {
        const u = new URL(b.url);
        if (u.protocol !== "http:" && u.protocol !== "https:") {
          errors.push(`navigation.buttons[${idx}].url must be http/https.`);
        }
      } catch {
        errors.push(`navigation.buttons[${idx}].url is invalid.`);
      }
    }
  });

  if (!cfg.errorScreen.title) errors.push("errorScreen.title is required.");
  if (!cfg.errorScreen.message) errors.push("errorScreen.message is required.");
  if (!cfg.errorScreen.retryButtonText) errors.push("errorScreen.retryButtonText is required.");
  if (!HEX_RE.test(cfg.errorScreen.accentColor)) errors.push("errorScreen.accentColor must be #RRGGBB.");
  if (!HEX_RE.test(cfg.errorScreen.backgroundColor)) errors.push("errorScreen.backgroundColor must be #RRGGBB.");
  if (!HEX_RE.test(cfg.errorScreen.textColor)) errors.push("errorScreen.textColor must be #RRGGBB.");

  return errors;
}

function applyConfigToForm(cfg) {
  const merged = {
    app: { ...DEFAULT_CONFIG.app, ...(cfg.app || {}) },
    userAgent: { ...DEFAULT_CONFIG.userAgent, ...(cfg.userAgent || {}) },
    behavior: { ...DEFAULT_CONFIG.behavior, ...(cfg.behavior || {}) },
    navigation: { ...DEFAULT_CONFIG.navigation, ...(cfg.navigation || {}) },
    errorScreen: { ...DEFAULT_CONFIG.errorScreen, ...(cfg.errorScreen || {}) },
    build: { ...DEFAULT_CONFIG.build, ...(cfg.build || {}) }
  };

  byId("app-name").value = merged.app.name;
  byId("app-packageId").value = merged.app.packageId;
  byId("app-version").value = merged.app.version;
  byId("app-url").value = merged.app.url;
  byId("app-icon-path").value = merged.app.icon;

  byId("ua-mode").value = merged.userAgent.mode;
  byId("ua-value").value = merged.userAgent.value;

  byId("beh-pullToRefresh").checked = Boolean(merged.behavior.pullToRefresh);
  byId("beh-smartCache").checked = Boolean(merged.behavior.smartCache);
  byId("beh-hardwareAcceleration").checked = Boolean(merged.behavior.hardwareAcceleration);
  byId("beh-preventBrightnessDrop").checked = Boolean(merged.behavior.preventBrightnessDrop);
  byId("beh-keepExternalDomainsInApp").checked = Boolean(merged.behavior.keepExternalDomainsInApp);
  byId("beh-externalSchemes").value = (merged.behavior.externalSchemes || []).join(", ");
  byId("beh-allowedDomains").value = (merged.behavior.allowedDomains || []).join(", ");

  byId("nav-enabled").checked = Boolean(merged.navigation.enabled);
  byId("nav-position").value = merged.navigation.position || "bottom";
  byId("nav-backgroundColor").value = merged.navigation.backgroundColor;
  byId("nav-backgroundColor-picker").value = HEX_RE.test(merged.navigation.backgroundColor)
    ? merged.navigation.backgroundColor
    : "#111827";
  byId("nav-iconColor").value = merged.navigation.iconColor;
  byId("nav-iconColor-picker").value = HEX_RE.test(merged.navigation.iconColor)
    ? merged.navigation.iconColor
    : "#FFFFFF";

  navButtonsState = Array.isArray(merged.navigation.buttons)
    ? structuredClone(merged.navigation.buttons).slice(0, 8)
    : [];
  renderNavButtons();

  byId("err-title").value = merged.errorScreen.title;
  byId("err-message").value = merged.errorScreen.message;
  byId("err-retryButtonText").value = merged.errorScreen.retryButtonText;
  byId("err-accentColor").value = merged.errorScreen.accentColor;
  byId("err-accentColor-picker").value = HEX_RE.test(merged.errorScreen.accentColor)
    ? merged.errorScreen.accentColor
    : "#2563EB";
  byId("err-backgroundColor").value = merged.errorScreen.backgroundColor;
  byId("err-backgroundColor-picker").value = HEX_RE.test(merged.errorScreen.backgroundColor)
    ? merged.errorScreen.backgroundColor
    : "#FFFFFF";
  byId("err-textColor").value = merged.errorScreen.textColor;
  byId("err-textColor-picker").value = HEX_RE.test(merged.errorScreen.textColor)
    ? merged.errorScreen.textColor
    : "#111827";

  byId("bld-android").checked = Boolean(merged.build.android);
  byId("bld-windows").checked = Boolean(merged.build.windows);
  byId("bld-macos").checked = Boolean(merged.build.macos);
  byId("bld-linux").checked = Boolean(merged.build.linux);

  refreshAll();
}

function drawRoundedRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function renderIconCanvas() {
  const canvas = byId("icon-canvas");
  const ctx = canvas.getContext("2d");
  const size = 1024;
  ctx.clearRect(0, 0, size, size);

  const radiusPct = Number(byId("icon-radius").value) || 0;
  const padPct = Number(byId("icon-padding").value) || 0;
  const transparent = byId("icon-bg-transparent").checked;
  const bgColor = byId("icon-bg-color").value;
  const radiusPx = Math.round((size * radiusPct) / 100);
  const padPx = Math.round((size * padPct) / 100);

  ctx.save();
  if (radiusPx > 0) {
    drawRoundedRectPath(ctx, 0, 0, size, size, radiusPx);
    ctx.clip();
  }

  if (!transparent) {
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, size, size);
  }

  if (loadedImage) {
    const targetSize = size - padPx * 2;
    const scale = Math.max(targetSize / loadedImage.width, targetSize / loadedImage.height);
    const drawW = loadedImage.width * scale;
    const drawH = loadedImage.height * scale;
    const dx = (size - drawW) / 2;
    const dy = (size - drawH) / 2;
    ctx.drawImage(loadedImage, dx, dy, drawW, drawH);
  } else {
    // Draw clean default Url2Native geometric icon.
    const margin = 32 + padPx;
    const cardSize = size - margin * 2;
    const grad = ctx.createLinearGradient(0, 0, size, size);
    grad.addColorStop(0, "#1D4ED8");
    grad.addColorStop(1, "#2563EB");
    ctx.fillStyle = grad;
    drawRoundedRectPath(ctx, margin, margin, cardSize, cardSize, Math.round(cardSize * 0.22));
    ctx.fill();

    ctx.strokeStyle = "#FFFFFF";
    ctx.lineWidth = Math.round(size * 0.052);
    const frameInset = Math.round(size * 0.23) + Math.round(padPx * 0.5);
    const frameSize = size - frameInset * 2;
    drawRoundedRectPath(ctx, frameInset, frameInset, frameSize, frameSize, Math.round(frameSize * 0.14));
    ctx.stroke();

    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(486, 445, 52, 185);
    ctx.beginPath();
    ctx.moveTo(512, 395);
    ctx.lineTo(612, 495);
    ctx.lineTo(412, 495);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function updateErrorPreview(cfg) {
  const preview = byId("error-preview");
  preview.style.backgroundColor = HEX_RE.test(cfg.errorScreen.backgroundColor)
    ? cfg.errorScreen.backgroundColor
    : "#FFFFFF";
  preview.style.color = HEX_RE.test(cfg.errorScreen.textColor)
    ? cfg.errorScreen.textColor
    : "#111827";
  byId("err-preview-title").textContent = cfg.errorScreen.title || "Connection Unavailable";
  byId("err-preview-message").textContent = cfg.errorScreen.message || "";
  const btn = byId("err-preview-btn");
  btn.textContent = cfg.errorScreen.retryButtonText || "Retry Connection";
  btn.style.backgroundColor = HEX_RE.test(cfg.errorScreen.accentColor)
    ? cfg.errorScreen.accentColor
    : "#2563EB";
}

function refreshAll() {
  const cfg = readConfigFromForm();
  const errors = validateConfigObject(cfg);
  const banner = byId("validation-banner");

  if (errors.length === 0) {
    banner.className = "banner banner-ok";
    banner.textContent = "Configuration is valid.";
  } else {
    banner.className = "banner banner-err";
    banner.textContent = `Fix ${errors.length} issue(s):\n- ${errors.join("\n- ")}`;
  }

  byId("download-config-btn").disabled = errors.length > 0;
  byId("gh-deploy-btn").disabled = errors.length > 0;
  byId("json-preview").textContent = JSON.stringify(cfg, null, 2);
  updateErrorPreview(cfg);
  renderIconCanvas();
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function getIconBlob() {
  return new Promise((resolve, reject) => {
    byId("icon-canvas").toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Failed to encode 1024x1024 PNG icon."));
    }, "image/png");
  });
}

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function utf8ToBase64(text) {
  return arrayBufferToBase64(new TextEncoder().encode(text).buffer);
}

async function githubRequest(path, token, method = "GET", body = null) {
  const res = await fetch(`https://api.github.com${path}`, {
    method,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: body ? JSON.stringify(body) : undefined
  });

  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }

  if (!res.ok) {
    const msg = json?.message || text || `HTTP ${res.status}`;
    throw new Error(`GitHub API error (${res.status}): ${msg}`);
  }
  return json;
}

async function deployToGitHub() {
  const statusEl = byId("gh-status");
  const repo = byId("gh-repo").value.trim();
  const branch = byId("gh-branch").value.trim() || "main";
  const token = byId("gh-token").value.trim();

  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo)) {
    statusEl.textContent = "Enter a valid repository as owner/repo.";
    return;
  }
  if (!token) {
    statusEl.textContent = "Enter a Fine-Grained GitHub PAT with Contents and Actions Read/Write.";
    return;
  }

  const cfg = readConfigFromForm();
  const errors = validateConfigObject(cfg);
  if (errors.length > 0) {
    statusEl.textContent = "Fix validation errors before deploying.";
    return;
  }

  const deployBtn = byId("gh-deploy-btn");
  deployBtn.disabled = true;
  statusEl.textContent = "Encoding config and 1024x1024 icon...";

  try {
    const configText = JSON.stringify(cfg, null, 2) + "\n";
    const iconBuf = await (await getIconBlob()).arrayBuffer();
    const iconBase64 = arrayBufferToBase64(iconBuf);
    const iconRepoPath = cfg.app.icon.replace(/^\/+/, "");

    statusEl.textContent = `Reading branch ${branch}...`;
    const refData = await githubRequest(
      `/repos/${repo}/git/ref/heads/${encodeURIComponent(branch)}`,
      token
    );
    const baseCommitSha = refData.object.sha;
    const baseCommit = await githubRequest(`/repos/${repo}/git/commits/${baseCommitSha}`, token);

    statusEl.textContent = "Uploading blobs...";
    const [cfgBlob, iconBlob] = await Promise.all([
      githubRequest(`/repos/${repo}/git/blobs`, token, "POST", {
        content: utf8ToBase64(configText),
        encoding: "base64"
      }),
      githubRequest(`/repos/${repo}/git/blobs`, token, "POST", {
        content: iconBase64,
        encoding: "base64"
      })
    ]);

    statusEl.textContent = "Creating commit...";
    const tree = await githubRequest(`/repos/${repo}/git/trees`, token, "POST", {
      base_tree: baseCommit.tree.sha,
      tree: [
        { path: "app.config.json", mode: "100644", type: "blob", sha: cfgBlob.sha },
        { path: iconRepoPath, mode: "100644", type: "blob", sha: iconBlob.sha }
      ]
    });

    const newCommit = await githubRequest(`/repos/${repo}/git/commits`, token, "POST", {
      message: `chore: update ${cfg.app.name} config and icon via Web Configurator`,
      tree: tree.sha,
      parents: [baseCommitSha]
    });

    await githubRequest(
      `/repos/${repo}/git/refs/heads/${encodeURIComponent(branch)}`,
      token,
      "PATCH",
      { sha: newCommit.sha, force: false }
    );

    statusEl.textContent = "Triggering Build and Release workflow...";
    await githubRequest(
      `/repos/${repo}/actions/workflows/build.yml/dispatches`,
      token,
      "POST",
      {
        ref: branch,
        inputs: {
          android: cfg.build.android ? "enable" : "disable",
          windows: cfg.build.windows ? "enable" : "disable",
          macos: cfg.build.macos ? "enable" : "disable",
          linux: cfg.build.linux ? "enable" : "disable"
        }
      }
    );

    statusEl.textContent = "";
    const msg = document.createElement("span");
    msg.textContent = "Committed and dispatched build workflow. Track progress at ";
    const link = document.createElement("a");
    link.href = `https://github.com/${repo}/actions`;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = `github.com/${repo}/actions`;
    statusEl.appendChild(msg);
    statusEl.appendChild(link);
  } catch (err) {
    statusEl.textContent = err.message;
  } finally {
    refreshAll();
  }
}

function detectGitHubRepo() {
  const host = window.location.hostname;
  if (host.endsWith(".github.io")) {
    const owner = host.split(".")[0];
    const parts = window.location.pathname.split("/").filter(Boolean);
    const repoName = parts[0] || "Url2Native";
    byId("gh-repo").value = `${owner}/${repoName}`;
  }
}

function init() {
  detectGitHubRepo();

  bindColorPair("nav-backgroundColor", "nav-backgroundColor-picker");
  bindColorPair("nav-iconColor", "nav-iconColor-picker");
  bindColorPair("err-accentColor", "err-accentColor-picker");
  bindColorPair("err-backgroundColor", "err-backgroundColor-picker");
  bindColorPair("err-textColor", "err-textColor-picker");

  byId("config-form").addEventListener("input", refreshAll);
  byId("config-form").addEventListener("change", refreshAll);

  byId("icon-bg-transparent").addEventListener("change", () => {
    byId("icon-bg-color").disabled = byId("icon-bg-transparent").checked;
    refreshAll();
  });
  byId("icon-bg-color").disabled = true;

  byId("icon-file-input").addEventListener("change", (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        loadedImage = img;
        byId("icon-status").textContent = `Loaded ${file.name} (${img.width}x${img.height}) -> 1024x1024 PNG`;
        refreshAll();
      };
      img.onerror = () => {
        byId("icon-status").textContent = "Failed to decode selected image file.";
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });

  byId("import-config-input").addEventListener("change", async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      applyConfigToForm(parsed);
    } catch (err) {
      byId("validation-banner").className = "banner banner-err";
      byId("validation-banner").textContent = `Invalid JSON file: ${err.message}`;
    }
  });

  byId("add-nav-btn").addEventListener("click", () => {
    if (navButtonsState.length >= 8) return;
    navButtonsState.push({ label: "Home", action: "home" });
    renderNavButtons();
    refreshAll();
  });

  byId("reset-defaults-btn").addEventListener("click", () => {
    loadedImage = null;
    byId("icon-file-input").value = "";
    byId("icon-radius").value = "0";
    byId("icon-padding").value = "0";
    byId("icon-bg-transparent").checked = true;
    byId("icon-bg-color").disabled = true;
    byId("icon-status").textContent = "Default geometric icon ready (1024x1024 PNG)";
    applyConfigToForm(DEFAULT_CONFIG);
  });

  byId("download-config-btn").addEventListener("click", () => {
    const cfg = readConfigFromForm();
    const blob = new Blob([JSON.stringify(cfg, null, 2) + "\n"], { type: "application/json" });
    triggerDownload(blob, "app.config.json");
  });

  byId("download-icon-btn").addEventListener("click", async () => {
    const blob = await getIconBlob();
    const iconName = (byId("app-icon-path").value.trim().split("/").pop() || "icon.png");
    triggerDownload(blob, iconName.endsWith(".png") ? iconName : "icon.png");
  });

  byId("copy-json-btn").addEventListener("click", async () => {
    const cfg = readConfigFromForm();
    await navigator.clipboard.writeText(JSON.stringify(cfg, null, 2) + "\n");
    const btn = byId("copy-json-btn");
    btn.textContent = "Copied";
    setTimeout(() => {
      btn.textContent = "Copy JSON";
    }, 1500);
  });

  byId("gh-deploy-btn").addEventListener("click", deployToGitHub);

  applyConfigToForm(DEFAULT_CONFIG);
}

init();
