#!/usr/bin/env python3
"""Generate HotM coverage inventory for the sibling Fortemi server routes.

This is an SDLC evidence helper, not a production build tool. It extracts
Axum route declarations from the Fortemi source checkout and compares them
with known HotM API/client/tool surfaces so planning artifacts can track
actual server capability coverage instead of relying on release-note memory.
"""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
from collections import Counter
from dataclasses import dataclass, asdict
from datetime import date
from pathlib import Path
from typing import Iterable


HOTM_ROOT = Path(__file__).resolve().parents[3]
WORKSPACE_ROOT = HOTM_ROOT.parent
FORTEMI_ROOT = WORKSPACE_ROOT / "fortemi"
MAIN_RS = FORTEMI_ROOT / "crates/matric-api/src/main.rs"
OUTPUT_DIR = HOTM_ROOT / ".aiwg/api/compatibility"
JSON_OUT = OUTPUT_DIR / "fortemi-v2026-07-route-coverage.json"
MD_OUT = OUTPUT_DIR / "fortemi-v2026-07-route-coverage.md"
EVIDENCE_MAP = OUTPUT_DIR / "fortemi-v2026-07-family-evidence-map.json"
EXPECTED_ROUTE_COUNT = 200
EXPECTED_FAMILY_COUNT = 36
EXPECTED_STATUS_COUNTS = {
    "covered": 186,
    "documented_exclusion": 14,
}
ROUTE_LEVEL_OVERRIDES = {
    ("POST", "/api/v1/vision/describe"): {
        "family": "vision_tools",
        "proposed_status": "covered",
        "proposed_surface": "Attachment preview action for supported image attachments",
        "tracker": "#259",
        "source": "ADR-011",
        "note": "Typed client and attachment action UX evidence have landed.",
    },
    ("POST", "/api/v1/audio/transcribe"): {
        "family": "audio_tools",
        "proposed_status": "covered",
        "proposed_surface": "Attachment preview action for audio/video attachments",
        "tracker": "#259",
        "source": "ADR-011",
        "note": "Typed client and attachment action UX evidence have landed.",
    },
    ("GET", "/api/v1/calls/{id}"): {
        "family": "realtime_calls",
        "proposed_status": "covered",
        "proposed_surface": "Admin API Surface call diagnostics",
        "tracker": "#259",
        "source": "ADR-011",
        "note": "Typed REST client and redacted Admin call diagnostics evidence have landed.",
    },
    ("GET", "/api/v1/realtime/twilio/{provider_call_id}"): {
        "family": "realtime_calls",
        "proposed_status": "documented_exclusion",
        "proposed_surface": "Admin API Surface no-claim message for provider-specific live validation",
        "tracker": "#259",
        "source": "ADR-011",
        "note": "HotM renders a documented-exclusion boundary and exposes no Twilio realtime helper.",
    },
}


@dataclass(frozen=True)
class ServerRoute:
    methods: list[str]
    path: str
    handler_expr: str
    family: str
    status: str
    hotm_evidence: str
    tracker: str


FAMILY_RULES: list[tuple[str, str, str, str, str]] = [
    ("/api/v1/chat/stream", "native_chat_stream", "covered", "ui/src/api/chat.ts native stream client and Agent Fortemi stream path", "#242"),
    ("/api/v1/health/streaming", "streaming_health", "covered", "ui/src/api/health.ts and ApiCapabilitiesPanel streaming health card", "#254"),
    ("/api/v1/ingest/", "streaming_ingest", "covered", "ui/src/api/ingest.ts and BackupManager NDJSON stream import", "#255"),
    ("/api/v1/webhooks/incoming", "incoming_webhook_receivers", "covered", "ui/src/api/webhooks.ts and Admin WebhooksPanel incoming receiver metadata surface", "#256"),
    ("/api/v1/inbound-sources", "inbound_sources", "covered", "ui/src/api/webhooks.ts and Admin WebhooksPanel inbound source metadata surface", "#256"),
    ("/api/v1/vision/", "vision_tools", "covered", "ui/src/api/mediaTools.ts and AttachmentsPanel image analysis action", "#259"),
    ("/api/v1/audio/", "audio_tools", "covered", "ui/src/api/mediaTools.ts and AttachmentsPanel audio/video transcription action", "#259"),
    ("/api/v1/calls/", "realtime_calls", "covered", "ui/src/api/calls.ts and ApiCapabilitiesPanel redacted call diagnostics", "#259"),
    ("/api/v1/realtime/twilio/", "realtime_calls", "documented_exclusion", "HotM documents no Twilio realtime WebSocket diagnostic surface and exposes no helper", "#259"),
    ("/api/v1/notes/{id}/attachments/tus", "attachments_tus", "covered", "tusUploader/uploadStore/JobQueueMonitor cover TUS verbs, resume, termination, degraded states, and no checksum-extension claim", "#257"),
    ("/api/v1/backup/database", "backup_archive", "covered", "ui/src/api/backup.ts and BackupManager cover database backup operations", "#257"),
    ("/api/v1/backup/memory/", "backup_archive", "covered", "ui/src/api/backup.ts and BackupManager memory backup route-group controls", "#257"),
    ("/api/v1/backup/knowledge-archive", "backup_archive", "covered", "ui/src/api/backup.ts and BackupManager knowledge archive route-group controls", "#257"),
    ("/api/v1/backup/metadata/", "backup_archive", "covered", "ui/src/api/backup.ts and BackupManager metadata sidecar controls", "#257"),
    ("/api/v1/backup/", "backup_archive", "covered", "ui/src/api/backup.ts and BackupManager cover backup/archive route shapes, UX groups, and portable sidecar limitation copy", "#257"),
    ("/api/v1/attachments", "attachments", "covered", "ui/src/api/attachments.ts and attachment browser/panels", "#257"),
    ("/api/v1/notes/{id}/attachments", "attachments", "covered", "ui/src/api/attachments.ts and upload store", "#257"),
    ("/api/v1/inference/", "inference", "covered", "ui/src/api/inference.ts and Admin inference settings/audit", "#253"),
    ("/api/v1/chat", "chat_sync", "covered", "ui/src/api/chat.ts and agent components", "#242"),
    ("/api/v1/webhooks", "outbound_webhooks", "covered", "ui/src/api/webhooks.ts and Admin WebhooksPanel", "#256"),
    ("/api/v1/system/compatibility", "system_compatibility", "covered", "ui/src/api/systemCompatibility.ts and ApiCapabilitiesPanel", "#244"),
    ("/api/v1/events", "realtime_events", "covered", "ui/src/api/events.ts and realtimeEventBus/websocket service", "#246"),
    ("/api/v1/ws", "realtime_events", "covered", "ui/src/services/websocket.ts fallback", "#246"),
    ("/api/v1/jobs", "jobs", "covered", "ui/src/api/jobs.ts and job panels/store", "#253"),
    ("/api/v1/extraction/", "jobs", "covered", "attachment/job status surfaces", "#253"),
    ("/api/v1/models", "models", "covered", "ui/src/api/chat.ts/inference settings model discovery", "#159"),
    ("/api/v1/document-types", "document_types", "covered", "ui/src/api/documents.ts and DocumentTypesPanel", "#253"),
    ("/api/v1/archives", "archives", "covered", "ui/src/api/archives.ts and ArchiveManager", "#253"),
    ("/api/v1/memories", "archives", "covered", "archive/memory routing APIs and ArchiveManager", "#253"),
    ("/api/v1/memory/info", "archives", "covered", "memory/archive status surfaces", "#253"),
    ("/api/v1/pke", "pke", "documented_exclusion", "No current HotM PKE UX claim; keep excluded until product slice", "#253"),
    ("/api/v1/concepts", "concepts", "covered", "ui/src/api/concepts.ts and ConceptBrowser", "#253"),
    ("/api/v1/collections", "collections", "covered", "ui/src/api/collections.ts and CollectionsManager", "#253"),
    ("/api/v1/templates", "templates", "covered", "ui/src/api/templates.ts and TemplateManager", "#253"),
    ("/api/v1/embedding-", "embeddings", "covered", "ui/src/api/embeddings.ts and embedding components", "#253"),
    ("/api/v1/graph", "graph", "covered", "ui/src/components/graph and link/search APIs", "#253"),
    ("/api/v1/search", "search", "covered", "ui/src/api/search.ts and SearchPage/agent tool", "#253"),
    ("/api/v1/tags", "tags", "covered", "ui/src/api/tags.ts and TagManager", "#253"),
    ("/api/v1/provenance", "provenance", "covered", "ui/src/api/provenance.ts and memory provenance APIs", "#253"),
    ("/api/v1/health/", "knowledge_health", "covered", "ui/src/api/health.ts and KnowledgeHealthDashboard", "#253"),
    ("/api/v1/rate-limit/status", "rate_limit", "documented_exclusion", "No HotM rate-limit UI claim yet; tracked by manifest/rate-limit planning", "#251"),
    ("/api/v1/api-keys", "auth_api_keys", "covered", "ui/src/api/auth.ts", "#231"),
    ("/oauth/", "oauth", "covered", "ui/src/api/auth.ts and Admin auth diagnostics cover discovery, authorize, register, token, introspect, revoke, and redaction", "#247"),
    ("/.well-known/oauth", "oauth", "covered", "ui/src/api/auth.ts and Admin auth diagnostics cover OAuth discovery metadata and redaction", "#247"),
    ("/health", "health", "covered", "health checks in compat/core client", "#253"),
    ("/openapi.yaml", "contract_docs", "covered", "ui/src/api/systemCompatibility.ts fetches advertised OpenAPI and Admin API Surface links it", "#253"),
    ("/asyncapi.yaml", "contract_docs", "covered", "ui/src/api/systemCompatibility.ts fetches advertised AsyncAPI and Admin API Surface links it", "#253"),
]


def extract_route_calls(source: str) -> Iterable[tuple[str, str]]:
    start = source.index("// Build router")
    end = source.index("// Middleware", start)
    block = source[start:end]
    cursor = 0
    token = ".route("
    while True:
        idx = block.find(token, cursor)
        if idx == -1:
            break
        open_idx = idx + len(".route")
        depth = 0
        close_idx = open_idx
        in_string = False
        escape = False
        for pos in range(open_idx, len(block)):
            ch = block[pos]
            if in_string:
                if escape:
                    escape = False
                elif ch == "\\":
                    escape = True
                elif ch == '"':
                    in_string = False
                continue
            if ch == '"':
                in_string = True
            elif ch == "(":
                depth += 1
            elif ch == ")":
                depth -= 1
                if depth == 0:
                    close_idx = pos
                    break
        call = block[open_idx + 1 : close_idx]
        match = re.match(r'\s*"([^"]+)"\s*,\s*(.*)\s*$', call, re.S)
        if match:
            yield match.group(1), " ".join(match.group(2).split())
        cursor = close_idx + 1


def infer_methods(handler_expr: str) -> list[str]:
    methods = []
    for method in ["get", "post", "patch", "put", "delete", "head", "options"]:
        if re.search(rf"\b{method}\s*\(", handler_expr):
            methods.append(method.upper())
    return methods or ["UNKNOWN"]


def classify(path: str) -> tuple[str, str, str, str]:
    for prefix, family, status, evidence, tracker in FAMILY_RULES:
        if path.startswith(prefix):
            return family, status, evidence, tracker
    if path.startswith("/api/v1/notes"):
        return "notes", "covered", "ui/src/api/notes.ts, extended.ts, versions.ts, links.ts", "#253"
    return "unclassified", "gap", "No coverage rule yet; verifier must classify this route", "#253"


def git_value(args: list[str], fallback: str) -> str:
    try:
        result = subprocess.run(
            ["git", "-C", str(FORTEMI_ROOT), *args],
            check=True,
            text=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
        )
    except (FileNotFoundError, subprocess.CalledProcessError):
        return fallback
    value = result.stdout.strip()
    return value or fallback


def fortemi_metadata() -> tuple[str, str]:
    commit = git_value(["rev-parse", "--short", "HEAD"], "unknown")
    latest_tag = git_value(
        ["describe", "--tags", "--match", "v[0-9]*", "--abbrev=0"],
        "unknown",
    )
    return commit, latest_tag


def build_diagnostics(summary: dict[str, object]) -> dict[str, object]:
    metadata_issues: list[str] = []
    evidence_issues: list[str] = []
    unclassified_routes = [
        route
        for route in summary.get("routes", [])
        if isinstance(route, dict) and route.get("family") == "unclassified"
    ]
    status_drift: dict[str, object] = {
        "route_count": None,
        "family_count": None,
        "status_counts": None,
    }

    if summary["fortemi_commit"] == "unknown":
        metadata_issues.append("Fortemi commit metadata is unknown")
    if summary["fortemi_latest_tag"] == "unknown":
        metadata_issues.append("Fortemi latest tag metadata is unknown")

    route_count = summary["route_count"]
    if route_count != EXPECTED_ROUTE_COUNT:
        status_drift["route_count"] = {
            "expected": EXPECTED_ROUTE_COUNT,
            "actual": route_count,
        }

    status_counts = summary["status_counts"]
    if not isinstance(status_counts, dict):
        evidence_issues.append("status_counts is not an object")
    elif status_counts != EXPECTED_STATUS_COUNTS:
        status_drift["status_counts"] = {
            "expected": EXPECTED_STATUS_COUNTS,
            "actual": status_counts,
        }

    family_counts = summary["family_counts"]
    if not isinstance(family_counts, dict):
        evidence_issues.append("family_counts is not an object")
        family_counts = {}
    elif len(family_counts) != EXPECTED_FAMILY_COUNT:
        status_drift["family_count"] = {
            "expected": EXPECTED_FAMILY_COUNT,
            "actual": len(family_counts),
        }

    if not EVIDENCE_MAP.exists():
        evidence_issues.append(f"missing evidence map: {EVIDENCE_MAP.relative_to(HOTM_ROOT)}")
        return {
            "metadata_issues": metadata_issues,
            "unclassified_routes": unclassified_routes,
            "status_drift": {key: value for key, value in status_drift.items() if value is not None},
            "evidence_issues": evidence_issues,
        }

    evidence = json.loads(EVIDENCE_MAP.read_text(encoding="utf-8"))
    families = evidence.get("families", {})
    if not isinstance(families, dict):
        evidence_issues.append("evidence map families field is not an object")
        return {
            "metadata_issues": metadata_issues,
            "unclassified_routes": unclassified_routes,
            "status_drift": {key: value for key, value in status_drift.items() if value is not None},
            "evidence_issues": evidence_issues,
        }

    generated_families = set(family_counts)
    evidence_families = set(families)
    missing = sorted(generated_families - evidence_families)
    extra = sorted(evidence_families - generated_families)
    if missing:
        evidence_issues.append(f"evidence map missing families: {', '.join(missing)}")
    if extra:
        evidence_issues.append(f"evidence map has extra families: {', '.join(extra)}")

    for family, meta in families.items():
        if not isinstance(meta, dict):
            evidence_issues.append(f"{family}: evidence metadata is not an object")
            continue
        status = meta.get("status")
        tracker = meta.get("tracker")
        if status != "covered" and not tracker:
            evidence_issues.append(f"{family}: non-covered family lacks tracker")
        if status == "covered" and not meta.get("source_files"):
            evidence_issues.append(f"{family}: covered family lacks source_files")
        for key in ("source_files", "test_files", "ui_surfaces"):
            values = meta.get(key, [])
            if not isinstance(values, list):
                evidence_issues.append(f"{family}: {key} is not a list")
                continue
            for raw in values:
                if raw and not (HOTM_ROOT / raw).exists():
                    evidence_issues.append(f"{family}: missing {key} path {raw}")

    return {
        "metadata_issues": metadata_issues,
        "unclassified_routes": unclassified_routes,
        "status_drift": {key: value for key, value in status_drift.items() if value is not None},
        "evidence_issues": evidence_issues,
    }


def route_level_overrides(routes: list[ServerRoute]) -> list[dict[str, object]]:
    overrides: list[dict[str, object]] = []
    for route in routes:
        for method in route.methods:
            override = ROUTE_LEVEL_OVERRIDES.get((method, route.path))
            if override:
                overrides.append(
                    {
                        "method": method,
                        "path": route.path,
                        "current_family": route.family,
                        "current_status": route.status,
                        **override,
                    }
                )
    return overrides


def check_inventory(summary: dict[str, object]) -> list[str]:
    diagnostics = summary.get("verifier_diagnostics")
    if not isinstance(diagnostics, dict):
        diagnostics = build_diagnostics(summary)

    errors: list[str] = []
    errors.extend(str(issue) for issue in diagnostics.get("metadata_issues", []))
    for route in diagnostics.get("unclassified_routes", []):
        if isinstance(route, dict):
            errors.append(f"unclassified route: {route.get('path')} ({', '.join(route.get('methods', []))})")
        else:
            errors.append(f"unclassified route: {route}")
    status_drift = diagnostics.get("status_drift", {})
    if isinstance(status_drift, dict):
        for key, drift in status_drift.items():
            if isinstance(drift, dict):
                errors.append(f"{key} drift: expected {drift.get('expected')}, got {drift.get('actual')}")
            else:
                errors.append(f"{key} drift: {drift}")
    errors.extend(str(issue) for issue in diagnostics.get("evidence_issues", []))
    return errors


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Generate and optionally validate the HotM Fortemi route coverage inventory."
    )
    parser.add_argument(
        "--check",
        action="store_true",
        help="Fail if generated route families, Git metadata, or evidence-map paths are invalid.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    source = MAIN_RS.read_text(encoding="utf-8")
    fortemi_commit, fortemi_latest_tag = fortemi_metadata()
    routes: list[ServerRoute] = []
    for path, handler_expr in extract_route_calls(source):
        family, status, evidence, tracker = classify(path)
        routes.append(
            ServerRoute(
                methods=infer_methods(handler_expr),
                path=path,
                handler_expr=handler_expr,
                family=family,
                status=status,
                hotm_evidence=evidence,
                tracker=tracker,
            )
        )

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    summary = {
        "generated_at": date.today().isoformat(),
        "fortemi_root": "../fortemi",
        "fortemi_commit": fortemi_commit,
        "fortemi_latest_tag": fortemi_latest_tag,
        "route_count": len(routes),
        "status_counts": dict(Counter(route.status for route in routes)),
        "family_counts": dict(Counter(route.family for route in routes)),
        "route_level_overrides": route_level_overrides(routes),
        "routes": [asdict(route) for route in routes],
    }
    summary["verifier_diagnostics"] = build_diagnostics(summary)
    JSON_OUT.write_text(json.dumps(summary, indent=2) + "\n", encoding="utf-8")

    lines = [
        "---",
        "title: Fortemi v2026.7.1 Route Coverage Inventory",
        "status: generated",
        f"date: {summary['generated_at']}",
        "artifact_type: api-coverage-inventory",
        "---",
        "",
        "# Fortemi v2026.7.1 Route Coverage Inventory",
        "",
        f"- Fortemi source: `{summary['fortemi_root']}`",
        f"- Fortemi commit: `{fortemi_commit}`",
        f"- Latest release tag: `{fortemi_latest_tag}`",
        f"- Extracted route declarations: `{len(routes)}`",
        "",
        "## Status Counts",
        "",
        "| Status | Count |",
        "| --- | ---: |",
    ]
    for status, count in sorted(Counter(route.status for route in routes).items()):
        lines.append(f"| {status} | {count} |")
    lines.extend(["", "## Family Counts", "", "| Family | Count |", "| --- | ---: |"])
    for family, count in sorted(Counter(route.family for route in routes).items()):
        lines.append(f"| {family} | {count} |")

    diagnostics = summary["verifier_diagnostics"]
    lines.extend(
        [
            "",
            "## Verifier Diagnostics",
            "",
            "| Diagnostic | Value |",
            "| --- | --- |",
            f"| Metadata issues | `{len(diagnostics['metadata_issues'])}` |",
            f"| Unclassified routes | `{len(diagnostics['unclassified_routes'])}` |",
            f"| Status drift fields | `{len(diagnostics['status_drift'])}` |",
            f"| Evidence issues | `{len(diagnostics['evidence_issues'])}` |",
        ]
    )
    if any(diagnostics.values()):
        lines.extend(["", "### Diagnostic Details", ""])
        for key in ("metadata_issues", "unclassified_routes", "status_drift", "evidence_issues"):
            value = diagnostics[key]
            if value:
                lines.append(f"- `{key}`: `{json.dumps(value, sort_keys=True)}`")
    else:
        lines.extend(["", "No verifier diagnostics are currently open."])

    lines.extend(
        [
            "",
            "## Route-Level Overrides",
            "",
            "These entries are advisory planning metadata for mixed dispositions. They do not change current route status without implementation or documented-exclusion evidence.",
            "",
            "| Method | Path | Current family | Current status | Proposed status | Proposed surface | Tracker | Source |",
            "| --- | --- | --- | --- | --- | --- | --- | --- |",
        ]
    )
    for override in summary["route_level_overrides"]:
        lines.append(
            "| `{method}` | `{path}` | {current_family} | {current_status} | {proposed_status} | {proposed_surface} | {tracker} | {source} |".format(
                **override
            )
        )
    if not summary["route_level_overrides"]:
        lines.append("|  |  |  |  |  | No route-level overrides are currently defined. |  |  |")

    lines.extend(
        [
            "",
            "## Route Matrix",
            "",
            "| Methods | Path | Family | Status | HotM evidence / disposition | Tracker |",
            "| --- | --- | --- | --- | --- | --- |",
        ]
    )
    for route in routes:
        methods = ", ".join(route.methods)
        lines.append(
            f"| `{methods}` | `{route.path}` | {route.family} | {route.status} | {route.hotm_evidence} | {route.tracker} |"
        )
    lines.append("")
    MD_OUT.write_text("\n".join(lines), encoding="utf-8")

    print(f"wrote {JSON_OUT.relative_to(HOTM_ROOT)}")
    print(f"wrote {MD_OUT.relative_to(HOTM_ROOT)}")
    print(json.dumps(summary["status_counts"], sort_keys=True))
    if args.check:
        errors = check_inventory(summary)
        if errors:
            for error in errors:
                print(f"check failed: {error}", file=sys.stderr)
            raise SystemExit(1)
        print("check passed: route inventory baseline, metadata, and evidence map are coherent")


if __name__ == "__main__":
    main()
