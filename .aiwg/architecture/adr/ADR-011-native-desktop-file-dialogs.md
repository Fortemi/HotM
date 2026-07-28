---
title: ADR-011 Native Desktop File Dialogs
status: accepted
date: 2026-07-27
issue: Fortemi/HotM#283
derived_from:
  - "@.aiwg/evidence/hotm-desktop-live-asset-receipt-2026-07-27.json"
  - "@.aiwg/evidence/hotm-live-tauri-full-v1-recovery-receipt-2026-07-28.json"
  - "@ui/scripts/verify-live-tauri-full-v1-receipt.cjs"
  - "@ui/src-tauri/src/lib.rs"
---

# ADR-011 Native Desktop File Dialogs

## Context

HotM's desktop commands invoked `zenity` as an external process for file selection and save
destinations. On the current GNOME/Wayland host, Zenity delegated file selection through the
desktop portal without a usable parent window and waited indefinitely. Command-core tests passed
with a fake executable, but that did not prove an operable launched desktop dialog.

The Tauri webview file input opened a usable GTK chooser, but files returned through that browser
surface are `File` objects. They do not exercise HotM's native local-path TUS command and cannot be
used as evidence for the desktop picker boundary.

The launched Linux receipt exercised a real native picker, live Fortemi TUS upload, and native
save/download. It did not include signed `2.0.0/full-v1` export, trust-required clean-memory
import, and recovered-file verification in the same run. An opt-in headless Rust receipt now
exercises that persistence path through the production Tauri upload and download command cores
without claiming that an interactive GUI was launched in the same run.

## Decision

Use the official `tauri-plugin-dialog` Rust API for desktop open and save dialogs:

- register the plugin in the Tauri builder;
- build dialogs from the main webview window so they are parented to HotM;
- use the plugin's default GTK3 backend on Linux;
- execute blocking picker operations on Tauri's blocking runtime;
- convert selected `FilePath` values to local paths before collecting bounded file metadata; and
- keep upload, download, authorization, memory-routing, TUS, and file verification behavior in the
  existing HotM commands.

The JavaScript command names and payload contracts remain unchanged.

## Consequences

- Linux desktop users no longer require a separately installed `zenity` executable.
- The picker and save dialog follow Tauri's supported cross-platform abstraction.
- Command-core tests validate selected-path metadata and download-to-file behavior without opening
  interactive dialogs in CI.
- The ignored live command-core receipt creates isolated source and recovery memories, uploads a
  deterministic local file through the production TUS core, downloads and reopens source bytes,
  exports signed `2.0.0/full-v1`, imports with `verify_signature=require`, and downloads and
  reopens recovered bytes. Its validator requires exact commits, a clean HotM worktree, matching
  byte counts, SHA-256 and BLAKE3 digests, and bounded claim flags.
- Bearer-auth receipt mode is accepted only when the same live server returns 401 for an
  unauthenticated notes probe. Both isolated memories must be deleted after the run.
- A launched interactive GUI receipt is separate from command-core CI evidence. The local receipt
  proves the current Linux/GTK3 cell only.
- The live signed receipt does not prove a launched Tauri GUI or interactive native dialog in that
  same run, non-Linux platforms, immutable CI publication before artifact upload completes, or
  suite-wide portability. Browser TUS resume remains separately scoped evidence.

## Verification

- `TAURI_CONFIG='{"bundle":{"externalBin":[]}}' cargo test native_ -- --nocapture`
- `TAURI_CONFIG='{"bundle":{"externalBin":[]}}' cargo test local_file_ -- --nocapture`
- `TAURI_CONFIG='{"bundle":{"externalBin":[]}}' cargo test tests::live_fortemi_tauri_local_file_full_v1_recovery_receipt -- --ignored --exact --nocapture`
- `npm run verify:live-tauri-full-v1-receipt -- <receipt.json>`
- `npm run verify:desktop-live-asset-receipt`
- `.aiwg/evidence/hotm-desktop-live-asset-receipt-2026-07-27.json`
- `.aiwg/evidence/hotm-live-tauri-full-v1-recovery-receipt-2026-07-28.json`
