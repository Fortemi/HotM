# Tauri Desktop Integration Plan

**Date**: 2026-02-19
**Phase**: Construction
**Scope**: Re-add Tauri v2 desktop wrapper with dual-build support and cross-platform installers

## 1. Objective

Re-integrate Tauri v2 as a desktop wrapper for HotM, supporting:
- **Standalone web build** (`npm run build`) — existing SPA served via nginx/static
- **Tauri desktop build** (`npm run tauri build`) — native desktop app with installers
- **Cross-platform packages**: `.deb` + `.AppImage` (Ubuntu), `.msi`/`.exe` (Windows), `.dmg` (macOS)

## 2. Architecture Decision

### Approach: Lightweight Tauri Shell (No Rust Backend)

The old HotM had an embedded Axum server. The new architecture uses Fortemi as an external API. Therefore:

- **No embedded Rust server** — Tauri wraps the React SPA only
- **Minimal Rust code** — system tray, global hotkey, window management
- **PlantUML rendering** — re-add as Tauri command (calls external PlantUML server)
- **API calls** — all go through the existing fetch-based API client to Fortemi

### Tauri v2 Stack
| Component | Version | Notes |
|-----------|---------|-------|
| tauri | ^2.4 | Latest stable v2 |
| tauri-cli | ^2.10 | Build toolchain |
| @tauri-apps/api | ^2.x | Frontend JS bindings |
| tauri-plugin-opener | ^2.x | URL/file opening |
| tauri-plugin-shell | ^2.x | Shell commands |
| tauri-plugin-notification | ^2.x | Desktop notifications |
| tauri-plugin-global-shortcut | ^2.x | Ctrl+Alt+H hotkey |
| Rust MSRV | 1.77.2+ | System has 1.92.0 |

## 3. Project Structure

```
ui/
├── src-tauri/                  # Tauri Rust backend
│   ├── Cargo.toml              # Rust dependencies
│   ├── tauri.conf.json         # Tauri configuration
│   ├── build.rs                # Build script
│   ├── capabilities/
│   │   └── default.json        # Permission capabilities
│   ├── icons/                  # App icons (all platforms)
│   │   ├── icon.png            # 1024x1024 base
│   │   ├── icon.ico            # Windows
│   │   ├── icon.icns           # macOS
│   │   └── *.png               # Various sizes
│   ├── installer/
│   │   └── nsis/               # NSIS installer customization
│   └── src/
│       ├── lib.rs              # Main Tauri app setup
│       └── plantuml.rs         # PlantUML rendering module
├── src/
│   ├── lib/
│   │   └── tauri.ts            # Tauri detection + IPC helpers
│   └── hooks/
│       └── useTauri.ts         # React hook for Tauri features
└── package.json                # Updated with Tauri scripts
```

## 4. Implementation Phases

### Phase A: Scaffolding (Issues 1-3)
1. Install Tauri CLI and initialize `src-tauri/`
2. Configure `tauri.conf.json` with app metadata
3. Update `vite.config.ts` for Tauri dev server compatibility
4. Add npm scripts: `tauri:dev`, `tauri:build`
5. Add `@tauri-apps/cli` and `@tauri-apps/api` to package.json

### Phase B: Desktop Features (Issues 4-5)
1. System tray with Show/Hide/Quit menu
2. Global hotkey (Ctrl+Alt+H) to toggle visibility
3. Close-to-tray behavior (minimize instead of quit)
4. PlantUML rendering via Tauri command
5. Window configuration (1200x800, centered, resizable)

### Phase C: Cross-Platform Bundles (Issue 6)
1. Linux: `.deb` package + `.AppImage`
2. Windows: NSIS installer (`.exe`)
3. macOS: `.dmg` bundle
4. Icon generation for all platforms
5. Bundle metadata (identifier, description, category)

### Phase D: CI/CD Workflow (Issue 7)
1. GitHub Actions workflow for Tauri builds
2. Matrix builds: ubuntu-latest, windows-latest, macos-latest
3. Artifact upload for each platform
4. Release automation with `tauri-apps/tauri-action`

### Phase E: Frontend Integration (Issue 8)
1. `isTauri()` detection utility
2. `useTauri` React hook for desktop-specific features
3. Conditional rendering for desktop-only UI elements
4. Environment variable handling in Tauri context

### Phase F: Testing (Issue 9)
1. Unit tests for Tauri utility functions
2. Unit tests for useTauri hook
3. Integration tests for build configurations
4. Vite config test for Tauri compatibility
5. Target: ~70% coverage on new code

## 5. Key Configuration

### tauri.conf.json (Core)
```json
{
  "$schema": "https://schema.tauri.app/config/2",
  "productName": "HotM",
  "version": "2026.2.0",
  "identifier": "com.hotm.app",
  "build": {
    "frontendDist": "../dist",
    "devUrl": "http://localhost:1420",
    "beforeBuildCommand": "npm run build",
    "beforeDevCommand": "npm run dev"
  },
  "app": {
    "windows": [{
      "title": "Hall of the Mind",
      "width": 1200,
      "height": 800,
      "center": true,
      "decorations": true,
      "resizable": true
    }],
    "trayIcon": {
      "iconPath": "icons/icon.png",
      "tooltip": "HotM"
    },
    "security": {
      "csp": null
    }
  },
  "bundle": {
    "active": true,
    "targets": "all",
    "icon": ["icons/32x32.png", "icons/128x128.png", "icons/128x128@2x.png", "icons/icon.icns", "icons/icon.ico"],
    "linux": {
      "deb": { "depends": ["libwebkit2gtk-4.1-0", "libgtk-3-0"] },
      "appimage": { "bundleMediaFramework": false }
    },
    "windows": {
      "nsis": { "installMode": "currentUser" }
    },
    "macOS": {
      "minimumSystemVersion": "10.15"
    }
  }
}
```

### Vite Config Changes
- Add `TAURI_DEV_HOST` support for remote development
- Exclude `src-tauri/` from file watching
- Keep port 1420 (already configured)

## 6. Dual Build Support

| Command | Output | Use Case |
|---------|--------|----------|
| `npm run build` | `ui/dist/` static SPA | Web deployment (Docker/nginx) |
| `npm run tauri dev` | Native window + dev server | Desktop development |
| `npm run tauri build` | Platform installer | Desktop distribution |
| `npm run tauri build -- --debug` | Debug desktop app | Desktop debugging |

## 7. Completion Criteria

- [ ] `npm run build` still produces working standalone SPA
- [ ] `npm run tauri dev` launches desktop window on Ubuntu
- [ ] `npm run tauri build` produces `.deb` and `.AppImage` on Ubuntu
- [ ] GitHub Actions workflow configured for 3-platform matrix build
- [ ] System tray with Show/Hide/Quit works
- [ ] Global hotkey Ctrl+Alt+H works
- [ ] New tests at ~70% coverage for Tauri-related code
- [ ] TypeScript compilation passes (`npx tsc --noEmit`)
- [ ] Existing test suite still passes

## 8. Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| Tauri dev deps not installed | Install via apt before build |
| WebKit version mismatch | Use libwebkit2gtk-4.1 (Tauri v2 default) |
| Existing tests break | Run full test suite after each change |
| Build size too large | No media framework bundling |
| CI runner missing deps | Use tauri-apps/tauri-action which handles deps |

## 9. Dependencies to Install

### System (Ubuntu)
```bash
sudo apt install -y libwebkit2gtk-4.1-dev libgtk-3-dev libsoup-3.0-dev \
  libjavascriptcoregtk-4.1-dev librsvg2-dev patchelf libayatana-appindicator3-dev
```

### npm (in ui/)
```bash
npm install --save @tauri-apps/api
npm install --save-dev @tauri-apps/cli
```
