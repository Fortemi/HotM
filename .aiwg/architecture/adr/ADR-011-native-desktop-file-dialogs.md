---
title: ADR-011 Native Desktop File Dialogs
status: accepted
date: 2026-07-27
issue: Fortemi/HotM#283
derived_from:
  - "@.aiwg/evidence/hotm-desktop-live-asset-receipt-2026-07-27.json"
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
- A launched interactive GUI receipt is separate from command-core CI evidence. The local receipt
  proves the current Linux/GTK3 cell only.
- This decision does not prove signed `2.0.0/full-v1` recovery, authenticated lifecycle behavior,
  non-Linux platforms, browser TUS resume, or suite-wide portability.

## Verification

- `TAURI_CONFIG='{"bundle":{"externalBin":[]}}' cargo test native_ -- --nocapture`
- `TAURI_CONFIG='{"bundle":{"externalBin":[]}}' cargo test local_file_ -- --nocapture`
- `npm run verify:desktop-live-asset-receipt`
- `.aiwg/evidence/hotm-desktop-live-asset-receipt-2026-07-27.json`
