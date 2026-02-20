# Tauri v2 Technical Research Report

**Date**: 2026-02-19
**Researcher**: Technical Researcher Agent
**Purpose**: Evaluate Tauri v2 for wrapping the HotM React/Vite SPA as a cross-platform desktop application

---

## Executive Summary

**Technology**: Tauri v2.10.2 (latest stable as of 2026-02-04)
**Purpose**: Cross-platform desktop application framework using Rust backend + system WebView frontend
**Recommendation**: Adopt (for desktop distribution)
**Confidence**: High

Tauri v2 is production-stable, actively maintained (releases every 1-2 weeks), and is an excellent fit for wrapping the HotM Vite + React SPA as a desktop application. The framework is specifically designed to support the dual web/desktop build pattern from a single codebase. The v2 security model's granular capability system is more secure than v1 and aligns well with HotM's security requirements.

---

## 1. Current Version

| Component | Version | Released |
|-----------|---------|----------|
| `tauri` (Rust crate) | **2.10.2** | 2026-02-04 |
| `tauri-cli` (Rust) | 2.10.0 | 2026-02-04 |
| `@tauri-apps/cli` (npm) | 2.10.0 | 2026-02-04 |
| `@tauri-apps/api` (npm) | 2.10.1 | 2026-02-04 |
| `tauri-build` | 2.5.5 | 2026-02-04 |
| `tauri-bundler` | 2.8.0 | 2026-02-04 |

**Minimum Rust version**: 1.77.2
**Minimum Node.js**: 18+ (LTS recommended)
**Release cadence**: Approximately 1-2 releases per week (very active)
**Total downloads (crates.io)**: ~10.6 million

Source: crates.io API (`https://crates.io/api/v1/crates/tauri`), GitHub releases API

---

## 2. Recommended Project Structure

For a Tauri v2 + Vite + React (TypeScript) application, the official `create-tauri-app` template (`template-react-ts`) produces this structure:

```
my-app/
├── src-tauri/                    # Rust/Tauri backend
│   ├── src/
│   │   ├── lib.rs               # Application logic (v2 uses lib crate)
│   │   └── main.rs              # Entry point (thin wrapper for lib.rs)
│   ├── capabilities/
│   │   └── default.json         # Permission capabilities (v2 security system)
│   ├── icons/                   # App icons (all sizes)
│   │   ├── 32x32.png
│   │   ├── 128x128.png
│   │   ├── 128x128@2x.png
│   │   ├── icon.icns            # macOS
│   │   └── icon.ico             # Windows
│   ├── Cargo.toml               # Rust manifest
│   ├── build.rs                 # Build script (required by Tauri)
│   └── tauri.conf.json          # Main Tauri configuration
├── src/                         # React frontend (unchanged from SPA)
│   ├── main.tsx
│   ├── App.tsx
│   └── ...
├── public/                      # Static assets
├── index.html                   # Vite entry point
├── vite.config.ts               # Vite config (Tauri-aware)
├── tsconfig.json
├── tsconfig.node.json
└── package.json
```

**Key insight for HotM**: The `src/` directory is identical to the existing web SPA. Tauri only adds `src-tauri/`. The HotM `ui/` directory would contain all of this, with `src-tauri/` added alongside the existing React source.

---

## 3. Configuration Files

### 3.1 `src-tauri/tauri.conf.json` (v2 format)

This is the primary configuration file. Schema reference: `https://schema.tauri.app/config/2`

```json
{
  "$schema": "https://schema.tauri.app/config/2",
  "productName": "HotM",
  "version": "2026.2.0",
  "identifier": "dev.integrolabs.hotm",
  "build": {
    "beforeDevCommand": "npm run dev",
    "devUrl": "http://localhost:5173",
    "beforeBuildCommand": "npm run build",
    "frontendDist": "../dist"
  },
  "app": {
    "windows": [
      {
        "title": "Hall of the Mind",
        "width": 1280,
        "height": 800,
        "minWidth": 800,
        "minHeight": 600
      }
    ],
    "security": {
      "csp": null
    }
  },
  "bundle": {
    "active": true,
    "targets": "all",
    "icon": [
      "icons/32x32.png",
      "icons/128x128.png",
      "icons/128x128@2x.png",
      "icons/icon.icns",
      "icons/icon.ico"
    ]
  }
}
```

**Critical v2 config changes from v1**:

| Setting | v1 | v2 |
|---------|----|----|
| Schema field | `tauri.conf.json` had no `$schema` | `"$schema": "https://schema.tauri.app/config/2"` |
| App identifier | `package.identifier` | Top-level `identifier` |
| Build section | `build.distDir`, `build.devPath` | `build.frontendDist`, `build.devUrl` |
| Security | `tauri.security` | `app.security` |
| Windows | `tauri.windows` | `app.windows` |
| Bundle targets | `bundle.targets` (strings) | `bundle.targets` (same, plus `"all"`) |
| Plugins section | N/A | `plugins` (top-level) |
| Custom protocol | `features = ["custom-protocol"]` in Cargo | Automatic in v2 (no feature flag needed) |

### 3.2 `src-tauri/Cargo.toml`

```toml
[package]
name = "hotm"
version = "0.1.0"
description = "Hall of the Mind desktop application"
authors = ["Fortemi"]
edition = "2021"

# IMPORTANT: v2 requires lib crate type (not just bin)
[lib]
name = "hotm_lib"
crate-type = ["staticlib", "cdylib", "rlib"]

[build-dependencies]
tauri-build = { version = "2", features = [] }

[dependencies]
tauri = { version = "2", features = [] }
tauri-plugin-opener = "2"      # Required for opening URLs/files
serde = { version = "1", features = ["derive"] }
serde_json = "1"

# Note: No [features] section needed in v2 - custom-protocol is automatic
```

**Key difference from v1**: v2 requires the `[lib]` section with `crate-type = ["staticlib", "cdylib", "rlib"]`. This is what allows mobile builds and proper library separation. The `custom-protocol` Cargo feature from v1 is gone — handled automatically.

### 3.3 `src-tauri/build.rs`

```rust
fn main() {
    tauri_build::build()
}
```

Minimal in most cases. Advanced cases (like the `api` example) use `tauri_build::try_build()` with plugin registration for static ACL codegen.

### 3.4 `src-tauri/src/lib.rs` (v2 pattern)

```rust
// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![greet])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

### 3.5 `src-tauri/src/main.rs` (v2 pattern)

```rust
// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    hotm_lib::run()
}
```

The `main.rs` is intentionally thin in v2; all logic lives in `lib.rs`.

### 3.6 `src-tauri/capabilities/default.json` (v2 security model)

```json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "default",
  "description": "Capability for the main window",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "opener:default"
  ]
}
```

The `gen/schemas/` directory is auto-generated by `tauri build` / `tauri dev`. Do not hand-edit those files.

### 3.7 `vite.config.ts` (Tauri-aware)

```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST;

export default defineConfig(async () => ({
  plugins: [react()],

  // Vite options tailored for Tauri development
  clearScreen: false,           // Prevent Vite from obscuring Rust errors
  server: {
    port: 1420,                  // Tauri expects a fixed port
    strictPort: true,            // Fail if port is unavailable
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      ignored: ["**/src-tauri/**"],  // Don't watch Rust files
    },
  },
}));
```

**Important**: Port `1420` is the Tauri default in `devUrl`. The `TAURI_DEV_HOST` env var is set when developing for mobile devices on a remote host.

### 3.8 `package.json` (additions for Tauri)

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "tauri": "tauri"
  },
  "dependencies": {
    "@tauri-apps/api": "^2",
    "@tauri-apps/plugin-opener": "^2"
  },
  "devDependencies": {
    "@tauri-apps/cli": "^2"
  }
}
```

---

## 4. Dual Build Mode: Web SPA and Desktop

This is a first-class supported pattern in Tauri v2. The Vite build produces web assets; Tauri wraps them. Both modes can share the same codebase.

### 4.1 Environment Detection

Tauri v2 provides a built-in `isTauri()` function:

```typescript
import { isTauri } from "@tauri-apps/api/core";

// Returns true when running inside Tauri desktop app
// Returns false when served as a regular web page
if (isTauri()) {
  // Use Tauri-specific features: file system, native dialogs, etc.
  const { invoke } = await import("@tauri-apps/api/core");
  const result = await invoke("my_command");
} else {
  // Fall back to web API calls
  const result = await fetch("/api/my-endpoint").then(r => r.json());
}
```

**Implementation mechanism**: `isTauri()` checks for `window.__TAURI_INTERNALS__` (the Tauri IPC bridge injected at runtime). It returns `false` in any regular browser context.

### 4.2 Build Scripts Pattern

```json
{
  "scripts": {
    "dev": "vite",                    // Pure web dev server
    "build": "tsc && vite build",     // Pure web production build
    "tauri:dev": "tauri dev",         // Desktop dev (launches Vite + Tauri)
    "tauri:build": "tauri build",     // Desktop production build
    "preview": "vite preview"         // Preview web build
  }
}
```

### 4.3 Conditional Feature Loading Pattern

For HotM, the recommended pattern is:

```typescript
// src/lib/tauri-bridge.ts
import { isTauri } from "@tauri-apps/api/core";

export const isDesktopApp = isTauri();

// Lazy-load Tauri APIs only when running as desktop app
export async function openExternalUrl(url: string): Promise<void> {
  if (isDesktopApp) {
    const { open } = await import("@tauri-apps/plugin-opener");
    await open(url);
  } else {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}
```

### 4.4 Vite Build Modes

Use Vite's `--mode` flag for environment-specific configurations:

```
# .env.tauri
VITE_PLATFORM=desktop

# .env.web
VITE_PLATFORM=web
```

Tauri automatically sets `TAURI_ENV_*` environment variables during `tauri build` / `tauri dev`.

---

## 5. Cross-Platform Packaging

### 5.1 Available Bundle Targets

Set in `tauri.conf.json` under `bundle.targets`:

| Platform | Format | Identifier |
|----------|--------|------------|
| Windows | MSI installer | `"msi"` |
| Windows | NSIS installer (.exe) | `"nsis"` |
| macOS | Application bundle | `"app"` |
| macOS | Disk image | `"dmg"` |
| Linux | Debian package | `"deb"` |
| Linux | AppImage | `"appimage"` |
| Linux | RPM package | `"rpm"` |

Use `"targets": "all"` to build all formats for the current platform.

### 5.2 Windows Configuration

```json
{
  "bundle": {
    "windows": {
      "webviewInstallMode": {
        "type": "downloadBootstrapper"
      },
      "wix": {
        "upgradeCode": "YOUR-STABLE-GUID-HERE",
        "language": {
          "en-US": {}
        }
      },
      "nsis": {
        "compression": "lzma",
        "installMode": "currentUser"
      }
    }
  }
}
```

**WebView2 installation modes** for Windows:
- `downloadBootstrapper` (default) - downloads if not present
- `embedBootstrapper` - bundles the bootstrapper
- `offlineInstaller` - bundles the full offline installer (~120MB larger)
- `skip` - assumes WebView2 is already installed (enterprise)
- `fixedRuntime` - bundles a specific WebView2 version

**Windows code signing** (environment variables):
```
TAURI_SIGNING_PRIVATE_KEY     - Path or content of .pfx/.p12 file
TAURI_SIGNING_PRIVATE_KEY_PASSWORD - Password for the key
```

### 5.3 macOS Configuration

```json
{
  "bundle": {
    "macOS": {
      "minimumSystemVersion": "10.15",
      "signingIdentity": "Developer ID Application: Your Name (TEAMID)",
      "hardenedRuntime": true,
      "entitlements": "./entitlements.plist",
      "providerShortName": "YOUR_PROVIDER"
    }
  }
}
```

**macOS code signing environment variables**:
```
APPLE_CERTIFICATE             - Base64-encoded .p12 certificate
APPLE_CERTIFICATE_PASSWORD    - Certificate password
APPLE_SIGNING_IDENTITY        - "Developer ID Application: Name (TEAMID)"
APPLE_ID                      - Apple ID email (for notarization)
APPLE_PASSWORD                - App-specific password (for notarization)
APPLE_TEAM_ID                 - 10-character team ID
```

**macOS build targets**:
- `aarch64-apple-darwin` - Apple Silicon (M1/M2/M3/M4)
- `x86_64-apple-darwin` - Intel Macs
- `universal-apple-darwin` - Universal binary (both architectures)

For Universal builds, both Rust targets must be installed:
```bash
rustup target add aarch64-apple-darwin x86_64-apple-darwin
```

### 5.4 Linux Configuration

```json
{
  "bundle": {
    "linux": {
      "deb": {
        "depends": [],
        "section": "utils",
        "priority": "optional"
      },
      "appimage": {
        "bundleMediaFramework": false
      },
      "rpm": {
        "compression": { "type": "Gzip" }
      }
    }
  }
}
```

**Linux system dependencies** (required to BUILD, not just run):
```bash
# Ubuntu/Debian (required for CI/CD runners)
sudo apt-get install -y \
  libwebkit2gtk-4.1-dev \
  libappindicator3-dev \
  librsvg2-dev \
  patchelf
```

**Important**: Tauri v2 uses `libwebkit2gtk-4.1-dev` (GTK4-compatible WebKit2GTK). Tauri v1 used `libwebkit2gtk-4.0-dev`. This is why Ubuntu 22.04 is required for Tauri v2 CI (Ubuntu 20.04 does not have `4.1`). Ubuntu 24.04 is supported as well.

---

## 6. GitHub Actions CI/CD

### 6.1 Official Action: `tauri-apps/tauri-action@v1`

The official GitHub Action handles the cross-platform build matrix. Key inputs:

| Input | Description |
|-------|-------------|
| `tagName` | Release tag (uses `__VERSION__` placeholder) |
| `releaseName` | Release name |
| `releaseDraft` | Create as draft |
| `prerelease` | Mark as prerelease |
| `args` | Additional `tauri build` args (used for target arch) |
| `projectPath` | Path to tauri project (if not root) |
| `tauriScript` | Custom script to run tauri (e.g., `npm run tauri:build`) |
| `uploadWorkflowArtifacts` | Upload as workflow artifacts (not release assets) |

### 6.2 Build-Only Workflow (PR validation)

```yaml
# .github/workflows/tauri-build.yml
name: Tauri Build Test

on: [pull_request]

jobs:
  test-tauri:
    strategy:
      fail-fast: false
      matrix:
        include:
          - platform: 'macos-latest'
            args: '--target aarch64-apple-darwin'
          - platform: 'macos-latest'
            args: '--target x86_64-apple-darwin'
          - platform: 'ubuntu-22.04'
            args: ''
          - platform: 'windows-latest'
            args: ''

    runs-on: ${{ matrix.platform }}
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: lts/*
          cache: 'npm'
          cache-dependency-path: ui/package-lock.json

      - name: Install Rust stable
        uses: dtolnay/rust-toolchain@stable
        with:
          targets: ${{ matrix.platform == 'macos-latest' && 'aarch64-apple-darwin,x86_64-apple-darwin' || '' }}

      - name: Install Linux dependencies
        if: matrix.platform == 'ubuntu-22.04'
        run: |
          sudo apt-get update
          sudo apt-get install -y \
            libwebkit2gtk-4.1-dev \
            libappindicator3-dev \
            librsvg2-dev \
            patchelf

      - name: Cache Rust build artifacts
        uses: Swatinem/rust-cache@v2
        with:
          workspaces: './ui/src-tauri -> target'

      - name: Install frontend dependencies
        run: npm ci
        working-directory: ui

      - name: Build Tauri app (no upload)
        uses: tauri-apps/tauri-action@v1
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        with:
          projectPath: './ui'
          args: ${{ matrix.args }}
```

### 6.3 Release Publish Workflow

```yaml
# .github/workflows/tauri-release.yml
name: Tauri Release

on:
  push:
    branches:
      - release

jobs:
  publish-tauri:
    permissions:
      contents: write
    strategy:
      fail-fast: false
      matrix:
        include:
          - platform: 'macos-latest'
            args: '--target aarch64-apple-darwin'
          - platform: 'macos-latest'
            args: '--target x86_64-apple-darwin'
          - platform: 'ubuntu-22.04'
            args: ''
          - platform: 'windows-latest'
            args: ''

    runs-on: ${{ matrix.platform }}
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: lts/*
          cache: 'npm'
          cache-dependency-path: ui/package-lock.json

      - name: Install Rust stable
        uses: dtolnay/rust-toolchain@stable
        with:
          targets: ${{ matrix.platform == 'macos-latest' && 'aarch64-apple-darwin,x86_64-apple-darwin' || '' }}

      - name: Install Linux dependencies
        if: matrix.platform == 'ubuntu-22.04'
        run: |
          sudo apt-get update
          sudo apt-get install -y \
            libwebkit2gtk-4.1-dev \
            libappindicator3-dev \
            librsvg2-dev \
            patchelf

      - name: Cache Rust build artifacts
        uses: Swatinem/rust-cache@v2
        with:
          workspaces: './ui/src-tauri -> target'

      - name: Install frontend dependencies
        run: npm ci
        working-directory: ui

      - name: Build and publish
        uses: tauri-apps/tauri-action@v1
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          # macOS signing (optional)
          APPLE_CERTIFICATE: ${{ secrets.APPLE_CERTIFICATE }}
          APPLE_CERTIFICATE_PASSWORD: ${{ secrets.APPLE_CERTIFICATE_PASSWORD }}
          APPLE_SIGNING_IDENTITY: ${{ secrets.APPLE_SIGNING_IDENTITY }}
          APPLE_ID: ${{ secrets.APPLE_ID }}
          APPLE_PASSWORD: ${{ secrets.APPLE_PASSWORD }}
          APPLE_TEAM_ID: ${{ secrets.APPLE_TEAM_ID }}
          # Windows signing (optional)
          TAURI_SIGNING_PRIVATE_KEY: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY }}
          TAURI_SIGNING_PRIVATE_KEY_PASSWORD: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY_PASSWORD }}
        with:
          projectPath: './ui'
          tagName: hotm-v__VERSION__
          releaseName: 'HotM v__VERSION__'
          releaseBody: 'See the assets to download and install this version.'
          releaseDraft: true
          prerelease: false
          args: ${{ matrix.args }}
```

### 6.4 Universal macOS Build Workflow

For a single universal binary (works on both Apple Silicon and Intel):

```yaml
matrix:
  include:
    - platform: 'macos-latest'
      args: '--target universal-apple-darwin'
```

Note: Universal binaries are larger (both architectures included) but simpler to distribute. Separate architecture builds reduce download size.

### 6.5 Rust Build Cache

Always add `Swatinem/rust-cache@v2` — Rust builds are slow (5-15 minutes cold, 1-3 minutes cached):

```yaml
- name: Cache Rust build artifacts
  uses: Swatinem/rust-cache@v2
  with:
    workspaces: './ui/src-tauri -> target'
```

---

## 7. System Dependencies by Platform

### 7.1 Windows

**For building:**
- Visual Studio 2022 Build Tools with "C++ desktop development" workload
- WebView2 SDK (usually bundled with VS Build Tools)
- Rust toolchain (via rustup)
- Node.js 18+

GitHub Actions `windows-latest` runners have all of these pre-installed.

**For running (user machine):**
- WebView2 Runtime (Windows 11 has it built-in; Windows 10 needs install)
- The NSIS/MSI installer handles WebView2 bootstrapping automatically

### 7.2 macOS

**For building:**
- Xcode Command Line Tools (`xcode-select --install`)
- Rust toolchain (via rustup)
- Node.js 18+
- For code signing: Apple Developer account + certificates

**For running (user machine):**
- macOS 10.15 Catalina or later (WebKit is built-in)
- No additional runtime dependencies

GitHub Actions `macos-latest` runners have Xcode and CLT pre-installed.

### 7.3 Linux (Ubuntu/Debian)

**For building:**
```bash
# System packages
sudo apt-get update
sudo apt-get install -y \
  libwebkit2gtk-4.1-dev \     # WebKit2GTK (Tauri v2 requires 4.1, not 4.0)
  libappindicator3-dev \       # System tray support
  librsvg2-dev \               # SVG rendering
  patchelf                     # For AppImage bundling

# Plus standard build tools
sudo apt-get install -y build-essential curl

# Rust (via rustup)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Node.js 18+
```

**Ubuntu version compatibility:**
- Ubuntu 22.04 (Jammy): Recommended for CI/CD — has `libwebkit2gtk-4.1-dev`
- Ubuntu 24.04 (Noble): Supported
- Ubuntu 20.04: NOT compatible with Tauri v2 (only has `libwebkit2gtk-4.0-dev`)

**For running (user machine):**
```bash
# For .deb packages - these are installed automatically
libwebkit2gtk-4.1
libappindicator3-1

# AppImage is self-contained - no system deps needed
```

### 7.4 Rust Targets

```bash
# Default (host architecture)
rustup toolchain install stable

# macOS Universal
rustup target add aarch64-apple-darwin x86_64-apple-darwin

# Cross-compilation to Linux from macOS (not recommended; use native Linux runner)
# Cross-compilation to Windows from Linux (requires additional setup)
```

---

## 8. Tauri v2 Key Changes from v1

### 8.1 Security Model (Major Change)

**v1**: Allowlist system — enabled/disabled entire feature groups (e.g., `"fs": {"all": true}`)

**v2**: Capabilities + Permissions system — granular per-command, per-window access control

```json
// v2: capabilities/default.json
{
  "identifier": "default",
  "windows": ["main"],
  "permissions": [
    "core:default",               // Core window/app operations
    "fs:allow-read-text-file",    // Specific fs permission
    "fs:allow-write-text-file",
    "opener:default"              // Open URLs/files
  ]
}
```

The `core:default` permission set includes: window management (read-only), scale factor, positioning, sizing, fullscreen queries, monitor enumeration.

**Scope system** for filesystem operations:
```json
{
  "permissions": [
    {
      "identifier": "fs:allow-read-text-file",
      "allow": [{ "path": "$APPDATA/**" }],
      "deny": [{ "path": "$APPDATA/*.key" }]
    }
  ]
}
```

### 8.2 Plugin System (Major Change)

**v1**: Features were bundled into the main `tauri` crate

**v2**: First-party features are separate plugins in `tauri-apps/plugins-workspace`

| Feature | v1 | v2 Plugin |
|---------|----|-----------|
| File system | Built-in allowlist | `tauri-plugin-fs` |
| HTTP client | Built-in allowlist | `tauri-plugin-http` |
| Shell/process | Built-in allowlist | `tauri-plugin-shell` |
| Dialogs | Built-in allowlist | `tauri-plugin-dialog` |
| Notifications | Built-in allowlist | `tauri-plugin-notification` |
| Clipboard | Built-in allowlist | `tauri-plugin-clipboard-manager` |
| Global shortcuts | Built-in allowlist | `tauri-plugin-global-shortcut` |
| App updater | Built-in | `tauri-plugin-updater` |
| System tray | Built-in | `tauri-plugin-tray` (now in core) |
| Open URLs/files | `shell` allowlist | `tauri-plugin-opener` (new) |
| Store/persistence | Community | `tauri-plugin-store` (official) |
| SQL | Community | `tauri-plugin-sql` (official) |

Adding a plugin (example: `tauri-plugin-fs`):

```toml
# Cargo.toml
[dependencies]
tauri-plugin-fs = "2"
```

```rust
// lib.rs
tauri::Builder::default()
    .plugin(tauri_plugin_fs::init())
    .run(tauri::generate_context!())
```

```json
// capabilities/default.json
{
  "permissions": [
    "fs:allow-read-text-file",
    "fs:allow-write-text-file"
  ]
}
```

```typescript
// Frontend
import { readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
```

### 8.3 Architecture Changes

**v2 uses a lib + bin crate structure** (required):
- `src-tauri/src/lib.rs` — application logic, `pub fn run()`
- `src-tauri/src/main.rs` — thin wrapper calling `lib::run()`
- The `[lib]` section in Cargo.toml with `crate-type = ["staticlib", "cdylib", "rlib"]`

This structure supports both desktop (binary) and mobile (library linked into iOS/Android app) from one codebase.

**v2 supports mobile** (`#[cfg_attr(mobile, tauri::mobile_entry_point)]` in lib.rs):
- Android: `tauri android init` / `tauri android build`
- iOS: `tauri ios init` / `tauri ios build`

### 8.4 JavaScript API Changes

| Tauri v1 | Tauri v2 |
|----------|----------|
| `@tauri-apps/api/tauri` (invoke) | `@tauri-apps/api/core` (invoke) |
| `@tauri-apps/api/shell` | `@tauri-apps/plugin-opener` |
| `@tauri-apps/api/fs` | `@tauri-apps/plugin-fs` |
| `@tauri-apps/api/dialog` | `@tauri-apps/plugin-dialog` |
| `@tauri-apps/api/http` | `@tauri-apps/plugin-http` |
| `@tauri-apps/api/notification` | `@tauri-apps/plugin-notification` |
| `@tauri-apps/api/global-shortcut` | `@tauri-apps/plugin-global-shortcut` |

Core API (always available without plugins):
```typescript
// These stay in @tauri-apps/api
import { invoke, isTauri, Channel } from "@tauri-apps/api/core";
import { listen, emit } from "@tauri-apps/api/event";
import { appWindow } from "@tauri-apps/api/window";
import { open, save } from "@tauri-apps/plugin-dialog";
```

### 8.5 Configuration Format Changes (Summary)

```jsonc
// v1 tauri.conf.json structure
{
  "package": {
    "productName": "app",
    "version": "0.1.0"
  },
  "tauri": {
    "allowlist": { "all": false, "shell": { "open": true } },
    "windows": [{ "title": "app" }],
    "bundle": { "active": true }
  },
  "build": {
    "distDir": "../dist",
    "devPath": "http://localhost:3000"
  }
}

// v2 tauri.conf.json structure
{
  "$schema": "https://schema.tauri.app/config/2",
  "productName": "app",
  "version": "0.1.0",
  "identifier": "com.example.app",
  "app": {
    "windows": [{ "title": "app" }],
    "security": { "csp": null }
  },
  "bundle": { "active": true, "targets": "all" },
  "build": {
    "frontendDist": "../dist",
    "devUrl": "http://localhost:5173"
  },
  "plugins": {}
}
```

### 8.6 Migration Tool

Tauri provides an automated migration command:
```bash
npx @tauri-apps/cli migrate
```

This handles most v1 → v2 configuration and allowlist conversions automatically.

---

## 9. Official Plugin Ecosystem (v2)

All maintained in `github.com/tauri-apps/plugins-workspace`:

| Plugin | npm Package | Use Case |
|--------|-------------|----------|
| fs | `@tauri-apps/plugin-fs` | File read/write |
| dialog | `@tauri-apps/plugin-dialog` | Native file/save dialogs |
| http | `@tauri-apps/plugin-http` | Bypasses CSP for HTTP requests |
| shell | `@tauri-apps/plugin-shell` | Execute system commands |
| opener | `@tauri-apps/plugin-opener` | Open URLs/files with default apps |
| notification | `@tauri-apps/plugin-notification` | OS notifications |
| store | `@tauri-apps/plugin-store` | Persistent key-value store |
| sql | `@tauri-apps/plugin-sql` | SQLite/MySQL/PostgreSQL (bundled SQLite) |
| updater | `@tauri-apps/plugin-updater` | Auto-update |
| log | `@tauri-apps/plugin-log` | Structured logging |
| websocket | `@tauri-apps/plugin-websocket` | WebSocket connections |
| global-shortcut | `@tauri-apps/plugin-global-shortcut` | Global keyboard shortcuts |
| clipboard-manager | `@tauri-apps/plugin-clipboard-manager` | Clipboard access |
| deep-link | `@tauri-apps/plugin-deep-link` | Custom URL scheme handling |
| window-state | `@tauri-apps/plugin-window-state` | Persist window position/size |
| single-instance | `@tauri-apps/plugin-single-instance` | Prevent multiple instances |
| process | `@tauri-apps/plugin-process` | App restart/exit control |
| autostart | `@tauri-apps/plugin-autostart` | Launch on system startup |
| upload | `@tauri-apps/plugin-upload` | File upload with progress |
| barcode-scanner | `@tauri-apps/plugin-barcode-scanner` | Mobile camera barcode scan |
| biometric | `@tauri-apps/plugin-biometric` | Fingerprint/Face ID |

---

## 10. Applicability to HotM

### 10.1 Integration Path

HotM's existing `ui/` structure maps cleanly to Tauri:

```
ui/
├── src-tauri/               # ADD: New Tauri backend
│   ├── src/lib.rs
│   ├── src/main.rs
│   ├── capabilities/default.json
│   ├── Cargo.toml
│   ├── build.rs
│   └── tauri.conf.json
├── src/                     # UNCHANGED: Existing React SPA
├── public/                  # UNCHANGED
├── index.html               # UNCHANGED
├── vite.config.ts           # MODIFY: Add Tauri-specific options
└── package.json             # MODIFY: Add tauri scripts + deps
```

### 10.2 `tauri.conf.json` for HotM

The `devUrl` must match HotM's current Vite port. Check `ui/vite.config.ts` — the existing config uses port `5173` (default Vite) or a custom port. Tauri's template uses `1420`. Pick one and keep it consistent.

```json
{
  "build": {
    "beforeDevCommand": "npm run dev",
    "devUrl": "http://localhost:5173",
    "beforeBuildCommand": "npm run build",
    "frontendDist": "../dist"
  }
}
```

### 10.3 Fortemi API Connectivity

When running as a Tauri desktop app, the React frontend still makes HTTP calls to the Fortemi API at `VITE_API_BASE_URL`. This works without any changes because Tauri's WebView has full network access by default.

For CSP, set:
```json
{
  "app": {
    "security": {
      "csp": "default-src 'self'; connect-src http://localhost:3000 https://your-api-domain.com"
    }
  }
}
```

Or set `"csp": null` during development to disable CSP enforcement.

### 10.4 Dual Build Strategy

Add to `ui/package.json`:
```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "tauri:dev": "tauri dev",
    "tauri:build": "tauri build",
    "tauri:build:windows": "tauri build --target x86_64-pc-windows-msvc",
    "tauri:build:macos-arm": "tauri build --target aarch64-apple-darwin",
    "tauri:build:macos-intel": "tauri build --target x86_64-apple-darwin",
    "tauri:build:linux": "tauri build"
  }
}
```

The existing `gh act -j frontend-tests` workflow remains for web tests. A separate `gh act -j tauri-build` job handles desktop builds.

---

## 11. Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| Linux WebKit2GTK version mismatch (4.0 vs 4.1) | Medium | High | Pin CI to Ubuntu 22.04+; document in CONTRIBUTING |
| Rust build times slowing CI | High | Medium | `Swatinem/rust-cache@v2`; `sccache` for distributed caching |
| macOS notarization failures | Medium | High | Use environment secrets; test notarization in staging release |
| WebView2 absent on Windows 10 users | Low | High | Use `downloadBootstrapper` mode in bundle config |
| CSP blocking Fortemi API calls | Medium | Medium | Configure `csp.connect-src` to include API domain |
| Tauri IPC used in web-only build | Low | Medium | Guard all `invoke()` calls with `isTauri()` check |
| Windows NSIS/WiX installer signing required for distribution | Medium | Medium | Use self-signed for internal; Apple/MS for public |

---

## 12. References

All findings are derived from the following primary sources (verified by direct API/content fetch):

1. **crates.io API** - Tauri crate metadata: `https://crates.io/api/v1/crates/tauri`
2. **GitHub releases API** - Release history: `https://api.github.com/repos/tauri-apps/tauri/releases`
3. **create-tauri-app templates** - Official template files: `https://github.com/tauri-apps/create-tauri-app/tree/dev/templates`
4. **Tauri API example** - Production-grade config: `https://github.com/tauri-apps/tauri/tree/dev/examples/api/src-tauri`
5. **tauri-action README** - CI/CD documentation: `https://github.com/tauri-apps/tauri-action`
6. **tauri-action example workflows** - Concrete YAML: `https://github.com/tauri-apps/tauri-action/tree/dev/examples`
7. **Tauri config schema** - Config reference: `https://schema.tauri.app/config/2`
8. **@tauri-apps/api npm** - JS API metadata: `https://registry.npmjs.org/@tauri-apps/api/latest`
9. **@tauri-apps/api/core.js** - `isTauri()` implementation: `https://cdn.jsdelivr.net/npm/@tauri-apps/api@2/core.js`
10. **plugins-workspace** - Official plugin list: `https://github.com/tauri-apps/plugins-workspace/tree/v2/plugins`
11. **tauri-action runner.ts** - Build runner logic: `https://github.com/tauri-apps/tauri-action/blob/dev/src/runner.ts`

---

*Evidence quality: HIGH — all findings from official Tauri repositories and package registries. No blog posts or third-party sources used.*
