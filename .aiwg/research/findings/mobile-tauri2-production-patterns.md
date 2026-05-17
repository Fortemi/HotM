---
title: "Tauri 2 mobile production patterns and pitfalls (May 2026)"
type: research-finding
created: 2026-05-17
topic: mobile-architecture
quality_baseline: MODERATE
related_artifacts:
  - .aiwg/architecture/adr-mobile-cloud-architecture.md
  - .aiwg/architecture/manifest-schema-v1.md
  - .aiwg/planning/mobile-expansion-phase-plan.md
  - .aiwg/reports/tauri-v2-research-2026-02.md
  - .aiwg/elaboration/responsive-design-spec.md
---

# Tauri 2 mobile production patterns and pitfalls (May 2026)

## Scope

Research to support the mobile-expansion ADR for HotM (React 19 + Vite + Tailwind + Tauri 2.10.2). The architectural decision to use Tauri 2 mobile over Capacitor was already made on the user's recommendation; this document validates the choice with evidence and surfaces known issues to avoid.

## 1. Production-readiness status (May 2026)

**Tauri 2 mobile became officially stable on 2024-10-02** with the 2.0 stable release and has shipped through 2.10.x as of February 2026 (Tauri 2.10.2 is what HotM currently depends on). The framework's own positioning is **"desktop-first with mobile reach"** — the maintainers have publicly acknowledged that calling mobile a first-class citizen was overpromising. This is the most important framing for our planning: Tauri 2 mobile *works* but is not a React Native peer; the plugin ecosystem is narrower and the team prioritizes desktop fixes when there's a conflict.

GRADE: HIGH (official Tauri blog, [tauri-20 announcement](https://v2.tauri.app/blog/tauri-20/))

## 2. Production case studies

Search engine results consistently surface three named apps from the Tauri team's own materials:

- **Hoppscotch** — API development environment, ships to mobile.
- **Spacedrive** — cross-platform file manager (well-known for being an early Tauri-mobile early adopter).
- **AppFlowy** — open-source Notion alternative.

Beyond these, the 2026 case-study landscape is thin and dominated by Medium and dev.to posts rather than well-documented enterprise-scale deployments. Two notable individual case studies surfaced:

- ["The iOS Frontier: A Case Study of Deploying Rust-Powered Tauri 2 Apps to the App Store"](https://medium.com/@monikasinghal713/the-ios-frontier-a-case-study-of-deploying-rust-powered-tauri-2-apps-to-the-app-store-%EF%B8%8F-a06fce17e8c1) (April 2026) — practitioner walkthrough of App Store submission specific to Tauri.
- ["What Happens When You Ship a Rust-Heavy App to the iOS App Store With Tauri 2"](https://medium.com/@trivajay259/what-happens-when-you-ship-a-rust-heavy-app-to-the-ios-app-store-with-tauri-2-ddea0584bae7) (April 2026) — referenced as a flow-like.com production app with offline + local AI features. Notably this is offline-first; relevant for understanding the local-mode capability that we explicitly are *not* using on mobile.

GRADE: LOW-MODERATE for the individual case studies (practitioner Medium posts, not peer-reviewed); HIGH for the named example apps which have public source.

**Implication for HotM:** the production track record is real but small. We are not pioneering a path — many people have shipped — but we are also not on a beaten-flat road. Plan for some friction during App Store submission specifically because review reviewers are less familiar with Tauri than with React Native or Flutter apps.

## 3. Plugin matrix — what's mobile-supported

The default mobile plugin set per Tauri 2.0 stable is intentionally narrow:

| Plugin | Mobile | Desktop | Notes |
|---|:---:|:---:|---|
| `notification` | ✅ | ✅ | Both APNs / FCM and OS-native desktop notifications |
| `dialog` | ✅ | ✅ | Native picker/alert dialogs |
| `http` | ✅ | ✅ | First-class on mobile; this is the main transport |
| `opener` | ✅ | ✅ | URL schemes / system opener |
| `clipboard-manager` | ✅ | ✅ | |
| `deep-link` | ✅ | ✅ | URL-handler registration |
| `biometric` | ✅ | ❌ | Mobile-only (Touch/Face ID, Android BiometricPrompt) |
| `barcode-scanner` | ✅ | ❌ | Mobile-only |
| `nfc` | ✅ | ❌ | Mobile-only |
| `shell` | ❌ | ✅ | **Sidecars don't work on mobile** |
| `global-shortcut` | ❌ | ✅ | No global keyboard shortcuts on mobile |
| System tray | ❌ | ✅ | Configured in `tauri.conf.json`; mobile ignores |
| Native menus | ❌ | ✅ | |

GRADE: HIGH (official Tauri blog post, [Tauri 2.0 Stable Release](https://v2.tauri.app/blog/tauri-20/))

**Implication for HotM:** every desktop-only plugin currently in our `Cargo.toml` (lines 20-22: `tauri-plugin-shell`, `tauri-plugin-global-shortcut`) and `tauri.conf.json` (line 14: tray icon) needs to be gated behind `#[cfg(desktop)]` for the mobile build. This is a one-time cleanup, well-trodden, low risk.

## 4. The sidecar gap (load-bearing for our case)

The Tauri sidecar pattern — embedding a separate process (Node.js, Python, compiled Rust binary) and spawning it via `tauri-plugin-shell` — is **not supported on iOS or Android**. There is no workaround that surfaces in any official channel; the cross-cutting tauri-apps GitHub discussion ([#11454](https://github.com/orgs/tauri-apps/discussions/11454)) confirms this is a fundamental architecture gap, not a missing feature on a roadmap.

Production teams that hit this take one of three paths:
1. **Convert the sidecar to a remote HTTP service** — most common; preserves the same client code via `tauri-plugin-http`. **This is HotM's chosen path.**
2. **Port sidecar logic to native Rust Tauri commands** — viable when the sidecar is itself written in Rust (which `matric-api` is), but requires significant glue work and may not be possible if the sidecar depends on Postgres/Ollama-like local services that themselves cannot run on mobile.
3. **FFI-bind a C/C++ library** — only when the sidecar logic can be re-expressed as a library rather than a process.

GRADE: HIGH (cited official discussion thread).

**Implication for HotM:** option (1) — already the planned architecture. The mobile build calls the same HTTPS endpoints as the desktop "cloud mode" client. The desktop "local mode" client retains the sidecar via the existing path. One frontend codebase, two backend modes, mobile only ever uses cloud.

## 5. Build and distribution mechanics

### Android (Google Play)

Per [v2.tauri.app/distribute/google-play/](https://v2.tauri.app/distribute/google-play/):

- Build command: `cargo tauri android build -- --aab` produces an Android App Bundle at `gen/android/app/build/outputs/bundle/universalRelease/app-universal-release.aab`.
- Version code auto-derives from `tauri.conf.json` version: `major*1000000 + minor*1000 + patch`. HotM's CalVer `2026.5.4` would map to `2026_005_004` — likely fine but worth a sanity-check before first publish.
- Architectures targeted by default: aarch64, armv7, i686, x86_64. Restrictable via `--target` to reduce binary size.
- Minimum Android: 7.0 (SDK 24).
- **First upload must be manual** to Google Play Console (signature/bundle verification). After that, Google Play Developer API integration is documented as WIP — meaning CI automation is partial.
- Code signing requires a keystore generated and stored as a CI secret. Lost keystore = lost app identity. Operationally critical.

### iOS (App Store)

Per [v2.tauri.app/distribute/app-store/](https://v2.tauri.app/distribute/app-store/):

- **Mac-only build environment**. Linux runners cannot cross-compile for iOS. This is the hardest single constraint.
- Build command: `cargo tauri ios build --export-method app-store-connect` produces an IPA at `src-tauri/gen/apple/build/arm64/$APPNAME.ipa`.
- Required artifacts: provisioning profile, `Entitlements.plist` with App Sandbox enabled, `Info.plist` declaring encryption compliance status, App Store Connect API key (Issuer ID + Key ID + `.p8` private key).
- Upload via `xcrun altool` with API credentials.
- App Sandbox is **mandatory** — Apple rejects non-sandboxed apps. Most relevant network/file/IPC entitlements must be enumerated in `Entitlements.plist`.

GRADE: HIGH (both URLs are official Tauri documentation, accessed 2026-05-17).

### CI cost reality

GitHub Actions Mac runners are roughly 10× the per-minute cost of Linux runners. For a project at HotM's scale this is real money. Mitigations:
- Build iOS only on release tags (not on every PR).
- Split iOS into a dedicated workflow file (mirrors the desktop-release.yml/desktop-build-matrix.yml split that already exists in this repo).
- Self-hosted Mac runner is an option if you already own Mac hardware that idles.

GRADE: MODERATE (general CI cost knowledge, GitHub Actions pricing pages are authoritative).

## 6. Known production issues to plan for

From practitioner posts and GitHub issue scans:

- **WebView quirks on older Android.** Devices running Android 9 or earlier ship WebView versions that diverge from current Chromium. Test against Android 10+ as a floor; document a minimum supported version.
- **iOS keyboard handling.** Programmatic keyboard show/hide is harder than on native iOS. Plan UX around keyboards staying open during state transitions.
- **Deep link reliability.** First-launch deep-link delivery on iOS has historically been flaky in Tauri 2; verify against the latest 2.x at integration time.
- **App Store review unfamiliarity.** Reviewers occasionally flag Tauri apps incorrectly as "wrapped web content" (Guideline 4.2). Mitigation: ensure native features (biometrics, push, share sheet) are present in the build, and document in the review notes that this is a native compiled app, not a WebView wrapper.
- **Bundle size.** Tauri mobile bundles are smaller than Capacitor or React Native by default but not by orders of magnitude. Architecture-specific builds matter for ARM-only releases.

GRADE: MODERATE (synthesized from practitioner posts and GitHub issue scans; not all individually citable but collectively well-attested).

## 7. Code-organization patterns for shared desktop + mobile

Standard pattern from Tauri 2 docs and practitioner posts:

```rust
// src-tauri/src/lib.rs
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default();

    #[cfg(desktop)]
    {
        builder = builder
            .plugin(tauri_plugin_shell::init())
            .plugin(tauri_plugin_global_shortcut::Builder::new().build())
            .system_tray(...);
    }

    #[cfg(mobile)]
    {
        builder = builder.plugin(tauri_plugin_biometric::init());
    }

    builder
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_notification::init())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

The frontend side uses build-time Vite env vars (`VITE_HOTM_API_BASE`, `VITE_HOTM_MODE`) to select desktop-local vs cloud transport. The same React code paths work in both modes once the HTTP client is the unified transport.

GRADE: HIGH (well-documented in Tauri 2 docs, [Mobile Plugin Development](https://v2.tauri.app/develop/plugins/develop-mobile/) and `[lib]` crate-types in `Cargo.toml` line 10-12 of the HotM repo already match the recommended pattern).

## 8. When to bail to Capacitor — honest signals

This research doesn't change the recommendation but documents bail-out triggers:

- If you need a native plugin not in Tauri's set and writing one in Rust is prohibitive (e.g., complex media SDK that needs Swift/Kotlin integration with months of work).
- If App Store rejection on review-process grounds becomes unfixable (multiple rejection cycles citing Guideline 4.2 specifically about Tauri internals).
- If the iOS Mac-runner build cost or Mac-only constraint blocks contributor workflows in a way that compromises velocity.

None of these apply at HotM's current scope.

## 9. Bottom line for the ADR

- **Tauri 2 mobile is production-grade and the correct choice for HotM** given the existing Tauri 2 desktop investment and the cloud-only mobile architecture decision.
- The **sidecar gap is a non-issue** given the cloud-only mobile path — the same HTTPS transport works on both platforms.
- The **plugin matrix maps cleanly** to HotM's needs once desktop-only plugins are `#[cfg(desktop)]`-gated.
- The **build/distribution path is documented and well-trodden** with the named caveats (Mac-only iOS, first-upload-manual on Play, CI cost premium for Mac runners).
- Plan for a small ramp on App Store review unfamiliarity but no architectural blocker.

## Sources

- [Tauri 2.0 Stable Release](https://v2.tauri.app/blog/tauri-20/) (GRADE: HIGH)
- [Tauri 2 — Distribute to Google Play](https://v2.tauri.app/distribute/google-play/) (GRADE: HIGH)
- [Tauri 2 — Distribute to App Store](https://v2.tauri.app/distribute/app-store/) (GRADE: HIGH)
- [Tauri 2 — Mobile Plugin Development](https://v2.tauri.app/develop/plugins/develop-mobile/) (GRADE: HIGH)
- [tauri-apps discussion #11454 — NodeJS sidecar for mobile apps](https://github.com/orgs/tauri-apps/discussions/11454) (GRADE: HIGH)
- [Tauri 2.0 Release Candidate blog](https://v2.tauri.app/blog/tauri-2-0-0-release-candidate/) (GRADE: HIGH)
- [The iOS Frontier (Singhal, April 2026)](https://medium.com/@monikasinghal713/the-ios-frontier-a-case-study-of-deploying-rust-powered-tauri-2-apps-to-the-app-store-%EF%B8%8F-a06fce17e8c1) (GRADE: LOW)
- [What Happens When You Ship a Rust-Heavy App (Kumar, April 2026)](https://medium.com/@trivajay259/what-happens-when-you-ship-a-rust-heavy-app-to-the-ios-app-store-with-tauri-2-ddea0584bae7) (GRADE: LOW)
- [Roadmap to Tauri 2.0](https://v2.tauri.app/blog/roadmap-to-tauri-2-0/) (GRADE: HIGH)
- [.aiwg/reports/tauri-v2-research-2026-02.md](../../reports/tauri-v2-research-2026-02.md) (GRADE: HIGH — prior internal research at 33KB)
