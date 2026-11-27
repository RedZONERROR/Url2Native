# Url2Native

Convert any web application URL into native, signed, installable applications for Android, Windows, macOS, and Linux using Tauri v2 and GitHub Actions.

<!-- CONFIGURATOR_URL_START -->
**Live Web Configurator:** https://redzonerror.github.io/Url2Native/
<!-- CONFIGURATOR_URL_END -->

---

## Language Switcher

- [English (en)](#english-en)
- [Hindi (hi)](#hindi-hi)
- [Bengali (bn)](#bengali-bn)
- [Spanish (es)](#spanish-es)
- [Mandarin Chinese (zh-CN)](#mandarin-chinese-zh-cn)
- [Arabic (ar)](#arabic-ar)

---

## Navigation

- [Target Platform Matrix](#target-platform-matrix)
- [Web Configurator (Visual Icon Picker and JSON Editor)](#web-configurator-visual-icon-picker-and-json-editor)
- [Repository Architecture](#repository-architecture)
- [Configuration Reference (app.config.json)](#configuration-reference-appconfigjson)
- [Custom Android Keystore Secret (Optional)](#custom-android-keystore-secret-optional)
- [Local Validation and Development](#local-validation-and-development)
- [License](#license)

---

## Target Platform Matrix

| Platform | OS / SDK Targets | Architectures | Output Installers |
| --- | --- | --- | --- |
| Android | API 29 - 37 (Android 10 - 17) | Split APKs (`arm64-v8a`, `armeabi-v7a`, `x86_64`) + Universal | Signed `.apk` files |
| Windows | Windows 10 and Windows 11 | x86_64 and aarch64 | `.exe` (NSIS), `.msi` |
| macOS | macOS 11 (Big Sur) and newer | universal-apple-darwin (Intel + Apple Silicon) | `.dmg`, `.app.zip` |
| Linux | Ubuntu 22.04+, Debian, Fedora, Arch | x86_64 and aarch64 | `.AppImage`, `.deb` |

---

## Web Configurator (Visual Icon Picker and JSON Editor)

Url2Native includes a static browser configurator at [docs/index.html](docs/index.html) so users do not have to hand-edit JSON or resize icons manually.

### Hosting on GitHub Pages (Manual Workflow)
A dedicated manual workflow ([.github/workflows/pages.yml](.github/workflows/pages.yml)) deploys [docs/](docs/) to GitHub Pages and automatically updates the **Live Web Configurator** link at the top of this README to match your repository (`https://<your-username>.github.io/<your-repo>/`):

1. Enable **Settings** -> **Actions** -> **General** -> **Workflow permissions** -> **Read and write permissions** (also required for `build.yml`).
2. Open **Settings** -> **Pages**, set **Build and deployment -> Source** to **GitHub Actions** (one-time setup; GitHub restricts workflows from enabling Pages automatically on first run).
3. Open **Actions** -> **Deploy Web Configurator (GitHub Pages)** and click **Run workflow** whenever you want to publish or update the page and sync the README link.

### Features
- **Icon File Picker (`<input type="file">`):** Select any PNG, JPG, WebP, or SVG image and convert it in-browser into a square `1024x1024` `icon.png` with optional corner radius, padding, and background fill.
- **Full `app.config.json` Editor:** Visual controls, toggles, color pickers, live error-screen preview, and navigation button editor for every section (`app`, `userAgent`, `behavior`, `navigation`, `errorScreen`, `build`).
- **Download Ready-to-Build Files:** Validate your settings live, download `app.config.json` and `icon.png` (1024x1024), upload them to the root of your repository, and run **Actions -> Build and Release Url2Native -> Run workflow** (no tokens required).

### Fork vs. Use This Template
- **Use this template (Recommended):** Creates a clean, independent repository with GitHub Actions enabled by default and zero upstream merge conflicts.
- **Fork:** Works cleanly as well. Keep **Copy the `main` branch only** checked when forking, then open the **Actions** tab on your fork and click **I understand my workflows, go ahead and enable them**. If a fork inherits an upstream `keystore-vault` branch, `build.yml` detects the owner mismatch via `vault_owner.txt` and automatically initializes a separate fork-owned `keystore-vault` branch.

---

## Repository Architecture

```text
Url2Native/
|-- app.config.json                     # User-editable single configuration file
|-- icon.png                            # User-editable 1024x1024 master PNG icon
|-- docs/                               # Static GitHub Pages Web Configurator
|   |-- index.html                      # Configurator UI with local icon file picker
|   |-- styles.css                      # Responsive fluid layout styles
|   |-- app.js                          # Schema validation, 1024x1024 PNG canvas, JSON export
|-- schema/
|   |-- app.config.schema.json          # Strict JSON Schema for pre-build validation
|-- scripts/
|   |-- configure.mjs                   # CLI entry point for pre-build pipeline
|   |-- apply-ci-overrides.mjs          # Resolves GitHub Actions Run workflow inputs and ABI mode
|   |-- fetch-ci-icon.mjs               # Downloads/converts optional app_icon_url to 1024x1024 PNG
|   |-- lib/
|       |-- validator.mjs               # Validates app.config.json and icon.png
|       |-- icon-generator.mjs          # Generates Android, Windows, macOS, Linux icons
|       |-- patch-tauri.mjs             # Updates tauri.conf.json and Cargo metadata
|       |-- patch-android.mjs           # Updates AndroidManifest.xml, build.gradle.kts, strings
|       |-- generate-ui.mjs             # Builds offline error screen and optional nav bar
|-- src-tauri/
|   |-- Cargo.toml                      # Rust dependencies and target configurations
|   |-- tauri.conf.json                 # Base Tauri v2 configuration
|   |-- src/
|       |-- main.rs                     # Desktop binary entry point
|       |-- lib.rs                      # Core Tauri setup and command registration
|       |-- config.rs                   # Embedded JSON configuration parser
|       |-- user_agent.rs               # User-Agent replace and append logic
|       |-- external_links.rs           # Deep-link and external scheme router
|       |-- power_manager.rs            # Cross-platform wake-lock implementation
|-- android-template/                   # Modular native Android overrides (API 29-37)
|   |-- AndroidManifest.xml             # Hardware accel, edge-to-edge, <queries> intents
|   |-- build.gradle.kts                # SDK 29-36 targets, signingConfigs, ABI splits
|   |-- kotlin/com/url2native/wrapper/
|       |-- MainActivity.kt             # Activity lifecycle, insets, back navigation
|       |-- WebViewConfigurator.kt      # User-Agent, Smart Cache, GPU hardware layers
|       |-- ExternalIntentHandler.kt    # UPI, WhatsApp, tel, mailto, intent:// handler
|       |-- BrightnessWakeManager.kt    # FLAG_KEEP_SCREEN_ON and window brightness lock
|       |-- PullToRefreshWrapper.kt     # SwipeRefreshLayout with top-scroll guard
|       |-- ErrorOverlayController.kt   # Branded offline/error view controller
|       |-- NavigationBarController.kt  # Optional JSON-driven native navigation bar
|-- ui/
|   |-- offline.template.html           # Responsive offline/error HTML template
|   |-- navbar.template.html            # Optional navigation overlay HTML/CSS/JS
|-- .github/
    |-- workflows/
        |-- build.yml                   # Dynamic OS/arch CI/CD + JKS vault + Releases
        |-- pages.yml                   # Manual Pages deploy (docs/) + README URL sync
```

---

## English (en)

### Quick Start Guide

1. **Create a repository from the template**
   - Open `https://github.com/RedZONERROR/Url2Native` and click **Use this template** -> **Create a new repository**.
   - Clone your new repository or edit files directly in the GitHub web editor.

2. **Enable GitHub Actions read and write permissions**
   - Go to your repository **Settings** -> **Actions** -> **General**.
   - Under **Workflow permissions**, select **Read and write permissions** and click **Save**.
   - This permission is required so the workflow can publish installers to GitHub Releases and store the encrypted Android signing vault on the orphan `keystore-vault` branch.

3. **Edit `app.config.json` and replace `icon.png`**
   - Update `app.name`, `app.packageId`, `app.version`, and `app.url` in `app.config.json`.
   - Replace root `icon.png` with your own square 1024x1024 PNG icon.

4. **Trigger the on-demand build**
   - Commit and push your changes to `app.config.json` or `icon.png`.
   - Open the **Actions** tab, select **Build and Release Url2Native**, and click **Run workflow**.
   - In the **Run workflow** dialog you can also override `app_name`, `package_id`, `app_url`, `app_version`, `app_icon_url` (optional image URL, falling back to repo `icon.png` when blank), `user_agent_mode`/`user_agent_value`, `navigation_*`, `behavior` toggles, `android_abis` (`split-and-universal`, `split-only`, or `universal-only`), and target platforms without editing `app.config.json` (any blank/`config` input falls back to `app.config.json`).

5. **Download your installers**
   - Once the workflow completes, open **Releases** in your repository sidebar to download the signed `.apk`, `.exe`, `.msi`, `.dmg`, `.app.zip`, `.AppImage`, and `.deb` files.

---

## Hindi (hi)

### त्वरित सेटअप गाइड

1. **टेम्पलेट से नया रिपॉजिटरी बनाएं**
   - `https://github.com/RedZONERROR/Url2Native` खोलें और **Use this template** -> **Create a new repository** पर क्लिक करें।

2. **GitHub Actions के लिए Read और Write अनुमति सक्षम करें**
   - अपने रिपॉजिटरी के **Settings** -> **Actions** -> **General** में जाएं।
   - **Workflow permissions** के अंतर्गत **Read and write permissions** चुनें और **Save** पर क्लिक करें।
   - यह अनुमति GitHub Releases प्रकाशित करने और `keystore-vault` ब्रांच में एन्क्रिप्टेड Android कीस्टोर सहेजने के लिए आवश्यक है।

3. **`app.config.json` संपादित करें और `icon.png` बदलें**
   - `app.config.json` में `app.name`, `app.packageId`, `app.version` और `app.url` को अपने ऐप के अनुसार अपडेट करें।
   - रूट में मौजूद `icon.png` को अपने 1024x1024 वर्गाकार PNG आइकन से बदलें।

4. **बिल्ड शुरू करें**
   - `app.config.json` या `icon.png` में किए गए बदलाव को कमिट और पुश करें, या **Actions** टैब से **Run workflow** चलाएं।
   - केवल `build` अनुभाग में `true` किए गए प्लेटफॉर्म ही बिल्ड किए जाएंगे।

5. **इंस्टॉलर डाउनलोड करें**
   - बिल्ड पूरा होने के बाद अपने रिपॉजिटरी के **Releases** अनुभाग से `.apk`, `.exe`, `.msi`, `.dmg`, `.app.zip`, `.AppImage` और `.deb` फाइलें डाउनलोड करें।

6. **वैकल्पिक कस्टम कीस्टोर ओवरराइड**
   - यदि आप अपना मौजूदा Android कीस्टोर उपयोग करना चाहते हैं, तो रिपॉजिटरी Secrets में `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS` और `ANDROID_KEY_PASSWORD` जोड़ें।

---

## Bengali (bn)

### দ্রুত সেটআপ নির্দেশিকা

1. **টেমপ্লেট থেকে নতুন রিপোজিটরি তৈরি করুন**
   - `https://github.com/RedZONERROR/Url2Native` খুলুন এবং **Use this template** -> **Create a new repository** এ ক্লিক করুন।

2. **GitHub Actions-এ Read এবং Write অনুমতি চালু করুন**
   - আপনার রিপোজিটরির **Settings** -> **Actions** -> **General** এ যান।
   - **Workflow permissions** অংশে **Read and write permissions** নির্বাচন করে **Save** চাপুন।
   - GitHub Releases প্রকাশ করা এবং `keystore-vault` ব্রাঞ্চে এনক্রিপ্টেড Android কীস্টোর সংরক্ষণের জন্য এটি প্রয়োজন।

3. **`app.config.json` সম্পাদনা করুন এবং `icon.png` পরিবর্তন করুন**
   - `app.config.json` ফাইলে `app.name`, `app.packageId`, `app.version` এবং `app.url` আপনার অ্যাপ অনুযায়ী পরিবর্তন করুন।
   - রুট ফোল্ডারের `icon.png` ফাইলটি আপনার নিজের 1024x1024 বর্গাকার PNG আইকন দিয়ে প্রতিস্থাপন করুন।

4. **বিল্ড চালু করুন**
   - `app.config.json` বা `icon.png` আপডেট করে পুশ করুন, অথবা **Actions** ট্যাব থেকে **Run workflow** চালান।
   - শুধুমাত্র `build` অংশে `true` হিসেবে নির্বাচিত প্ল্যাটফর্মগুলোর জন্যই রানার চালু হবে।

5. **ইনস্টলার ডাউনলোড করুন**
   - ওয়ার্কফ্লো সম্পন্ন হলে রিপোজিটরির **Releases** পাতা থেকে সাইন করা `.apk`, `.exe`, `.msi`, `.dmg`, `.app.zip`, `.AppImage` এবং `.deb` ফাইল ডাউনলোড করুন।

6. **ঐচ্ছিক কাস্টম কীস্টোর সিক্রেট**
   - নিজস্ব `.jks` কীস্টোর ব্যবহার করতে চাইলে রিপোজিটরি Secrets-এ `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS` এবং `ANDROID_KEY_PASSWORD` যোগ করুন।

---

## Spanish (es)

### Guia de Inicio Rapido

1. **Crear un repositorio desde la plantilla**
   - Abre `https://github.com/RedZONERROR/Url2Native` y haz clic en **Use this template** -> **Create a new repository**.

2. **Habilitar permisos de lectura y escritura en GitHub Actions**
   - Ve a **Settings** -> **Actions** -> **General** en tu repositorio.
   - En **Workflow permissions**, selecciona **Read and write permissions** y guarda los cambios con **Save**.
   - Esto permite publicar instaladores en GitHub Releases y guardar el almacen de claves Android cifrado en la rama `keystore-vault`.

3. **Editar `app.config.json` y reemplazar `icon.png`**
   - Configura `app.name`, `app.packageId`, `app.version` y `app.url` en `app.config.json`.
   - Reemplaza `icon.png` en la raiz del proyecto con tu propio icono PNG cuadrado de 1024x1024.

4. **Ejecutar la compilacion**
   - Haz commit y push de los cambios en `app.config.json` o `icon.png`, o ejecuta manualmente desde la pestana **Actions** -> **Run workflow**.
   - Solo se iniciaran ejecutores para las plataformas habilitadas en `build`.

5. **Descargar los instaladores**
   - Al finalizar la ejecucion, abre **Releases** en tu repositorio para descargar `.apk`, `.exe`, `.msi`, `.dmg`, `.app.zip`, `.AppImage` y `.deb`.

6. **Clave Android personalizada opcional**
   - Para usar tu propio archivo `.jks`, agrega los secretos `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS` y `ANDROID_KEY_PASSWORD` en Settings -> Secrets and variables -> Actions.

---

## Mandarin Chinese (zh-CN)

### 快速开始指南

1. **从模板创建仓库**
   - 打开 `https://github.com/RedZONERROR/Url2Native`，点击 **Use this template** -> **Create a new repository**。

2. **开启 GitHub Actions 读写权限**
   - 进入仓库的 **Settings** -> **Actions** -> **General**。
   - 在 **Workflow permissions** 下选择 **Read and write permissions** 并点击 **Save**。
   - 工作流需要此权限来发布 GitHub Releases 并在 `keystore-vault` 分支中保存加密的 Android 签名密钥库。

3. **编辑 `app.config.json` 并替换 `icon.png`**
   - 在 `app.config.json` 中修改 `app.name`、`app.packageId`、`app.version` 和 `app.url`。
   - 用你自己的 1024x1024 正方形 PNG 图标替换根目录下的 `icon.png`。

4. **触发构建**
   - 提交并推送对 `app.config.json` 或 `icon.png` 的更改，或在 **Actions** 页面手动点击 **Run workflow**。
   - 工作流只会为 `build` 中设置为 `true` 的目标平台启动构建任务。

5. **下载安装包**
   - 构建完成后，打开仓库右侧的 **Releases** 页面，即可下载已签名的 `.apk`、`.exe`、`.msi`、`.dmg`、`.app.zip`、`.AppImage` 和 `.deb` 文件。

6. **可选的自定义签名密钥覆盖**
   - 如果需要使用自己的 Android `.jks` 密钥库，请在仓库 Secrets 中添加 `ANDROID_KEYSTORE_BASE64`、`ANDROID_KEYSTORE_PASSWORD`、`ANDROID_KEY_ALIAS` 和 `ANDROID_KEY_PASSWORD`。

---

## Arabic (ar)

### دليل البدء السريع

1. **انشاء مستودع جديد من القالب**
   - افتح `https://github.com/RedZONERROR/Url2Native` ثم اضغط على **Use this template** -> **Create a new repository**.

2. **تفعيل صلاحيات القراءة والكتابة لخدمة GitHub Actions**
   - انتقل الى **Settings** -> **Actions** -> **General** داخل المستودع الخاص بك.
   - ضمن قسم **Workflow permissions**، اختر **Read and write permissions** ثم اضغط **Save**.
   - هذه الصلاحية مطلوبة لنشر الملفات في GitHub Releases وحفظ ملف التوقيع المشفر في فرع `keystore-vault`.

3. **تعديل ملف `app.config.json` واستبدال `icon.png`**
   - قم بتحديث الحقول `app.name` و `app.packageId` و `app.version` و `app.url` في ملف `app.config.json`.
   - استبدل ملف `icon.png` في المجلد الرئيسي بايقونة PNG مربعة بحجم 1024x1024.

4. **تشغيل عملية البناء**
   - قم بعمل commit و push للتعديلات على `app.config.json` او `icon.png`، او قم بتشغيل البناء يدويا من تبويب **Actions** عبر **Run workflow**.
   - سيتم تشغيل الخوادم فقط للانظمة المفعلة داخل قسم `build`.

5. **تنزيل حزم التثبيت**
   - بعد انتهاء البناء، انتقل الى قسم **Releases** في المستودع لتنزيل ملفات `.apk` و `.exe` و `.msi` و `.dmg` و `.app.zip` و `.AppImage` و `.deb`.

6. **استخدام مفتاح توقيع Android مخصص (اختياري)**
   - لاستخدام ملف `.jks` خاص بك، اضف المتغيرات التالية في Repository Secrets: `ANDROID_KEYSTORE_BASE64` و `ANDROID_KEYSTORE_PASSWORD` و `ANDROID_KEY_ALIAS` و `ANDROID_KEY_PASSWORD`.

---

## Configuration Reference (app.config.json)

All customization is controlled through [app.config.json](app.config.json) and validated against [schema/app.config.schema.json](schema/app.config.schema.json).

### `app`

| Field | Type | Description |
| --- | --- | --- |
| `app.name` | string (1-64) | Display name of the application on desktop and mobile. |
| `app.packageId` | string | Reverse-domain identifier (e.g. `com.example.myapp`). Must contain lowercase letters, digits, or underscores separated by dots. |
| `app.version` | string | Semantic version (e.g. `1.0.0`). Used for bundle versions and Android `versionName` / `versionCode`. |
| `app.url` | string (URL) | Target web application URL (`http://` or `https://`). |
| `app.icon` | string | Relative path to the master square PNG icon (default: `icon.png`). |

### `userAgent`

| Field | Type | Description |
| --- | --- | --- |
| `userAgent.mode` | `"default" \| "replace" \| "append"` | Retained in `app.config.json` for schema compatibility. At runtime, all platforms automatically prepend `NativeApp/1.0` before the native system WebView User-Agent. |
| `userAgent.value` | string | Custom User-Agent string or suffix. Required when `mode` is `replace` or `append`. |

### `behavior`

| Field | Type | Description |
| --- | --- | --- |
| `behavior.pullToRefresh` | boolean | Enables Android `SwipeRefreshLayout` guarded so refresh triggers only when `webView.scrollY == 0`. |
| `behavior.smartCache` | boolean | Enables DOM Storage, IndexedDB, and automatic switching between `LOAD_DEFAULT` (online) and `LOAD_CACHE_ELSE_NETWORK` (offline) on Android. |
| `behavior.hardwareAcceleration` | boolean | Enables hardware-accelerated WebView layers (`LAYER_TYPE_HARDWARE`) and GPU compositing. |
| `behavior.preventBrightnessDrop` | boolean | Keeps screen awake (`FLAG_KEEP_SCREEN_ON` and brightness lock on Android; `SetThreadExecutionState` on Windows; `IOPMAssertion` on macOS; `org.freedesktop.ScreenSaver` D-Bus on Linux). |
| `behavior.externalSchemes` | string[] | URI schemes handed off to the host OS (e.g. `whatsapp`, `upi`, `tez`, `phonepe`, `paytmmp`, `tel`, `mailto`, `sms`, `geo`, `intent`). |
| `behavior.keepExternalDomainsInApp` | boolean | When `false`, external HTTP/HTTPS domains open in the device default browser. When `true`, all HTTP/HTTPS links stay inside the app. |
| `behavior.allowedDomains` | string[] | Additional domains (e.g. `cdn.example.com` or `*.auth.example.com`) permitted inside the in-app WebView when `keepExternalDomainsInApp` is `false`. |

### `navigation`

| Field | Type | Description |
| --- | --- | --- |
| `navigation.enabled` | boolean | When `false`, runs in full-bleed mode with zero browser toolbars. When `true`, renders the configured bar. |
| `navigation.position` | `"top" \| "bottom"` | Placement of the navigation bar. |
| `navigation.backgroundColor` | string (hex) | Background hex color (`#RRGGBB`). |
| `navigation.iconColor` | string (hex) | Text and icon hex color (`#RRGGBB`). |
| `navigation.buttons` | object[] | Array of up to 8 buttons. Each item defines `label` and either `action` (`back`, `forward`, `home`, `reload`) or a custom `url`. |

### `errorScreen`

| Field | Type | Description |
| --- | --- | --- |
| `errorScreen.title` | string | Heading displayed on main-frame offline/network failures. |
| `errorScreen.message` | string | Descriptive message displayed below the heading. |
| `errorScreen.retryButtonText` | string | Label for the retry button. |
| `errorScreen.accentColor` | string (hex) | Primary button and icon highlight color (`#RRGGBB`). |
| `errorScreen.backgroundColor` | string (hex) | Background color (`#RRGGBB`). |
| `errorScreen.textColor` | string (hex) | Foreground text color (`#RRGGBB`). |

### `build`

| Field | Type | Description |
| --- | --- | --- |
| `build.android` | boolean | Enable or skip Android APK builds. |
| `build.windows` | boolean | Enable or skip Windows x64 and ARM64 builds. |
| `build.macos` | boolean | Enable or skip macOS Universal builds. |
| `build.linux` | boolean | Enable or skip Linux x64 and ARM64 builds. |

---

## Custom Android Keystore Secret (Optional)

By default, Url2Native automatically creates a 2048-bit RSA keystore on the first CI run, encrypts it with OpenSSL AES-256-CBC using a repository-bound key, and stores the encrypted payload in an orphan `keystore-vault` branch. Subsequent builds reuse the same signing key so Android app updates install cleanly without signature mismatches.

To supply your own existing keystore instead:

1. Encode your `.jks` file as base64:
   ```bash
   base64 -w 0 release.jks
   ```
2. Open your GitHub repository **Settings** -> **Secrets and variables** -> **Actions** and create these repository secrets:
   - `ANDROID_KEYSTORE_BASE64`: Base64-encoded contents of your `.jks` file.
   - `ANDROID_KEYSTORE_PASSWORD`: Keystore password.
   - `ANDROID_KEY_ALIAS`: Signing key alias.
   - `ANDROID_KEY_PASSWORD`: Signing key password.

---

## Local Validation and Development

Prerequisites: Node.js 20+, Rust stable toolchain, and platform-specific Tauri v2 prerequisites.

```bash
# Validate app.config.json and icon.png without modifying files
node scripts/configure.mjs --check-only

# Run the full pre-build pipeline (UI generation, icons, Tauri and Android patching)
node scripts/configure.mjs

# Run Rust unit tests
cargo test --manifest-path src-tauri/Cargo.toml

# Install CLI dependencies and run a local desktop development build
npm install
npx tauri dev
```

---

## License

This project is released under the [MIT License](LICENSE).
