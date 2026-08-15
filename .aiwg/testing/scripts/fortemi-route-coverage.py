#!/usr/bin/env python3
"""Generate HotM route and operation-level Fortemi coverage evidence.

This is an SDLC evidence helper, not a production build tool. Route inventory
remains route-disposition evidence only. Operation conformance is modeled from
the pinned OpenAPI contract and explicit evidence data so request, response,
auth/context, UI, agent, and live receipt claims cannot be inferred from route
prefixes or matching source-file names.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import subprocess
import sys
from collections import Counter
from dataclasses import asdict, dataclass
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any, Iterable

import yaml


HOTM_ROOT = Path(__file__).resolve().parents[3]
WORKSPACE_ROOT = HOTM_ROOT.parent
FORTEMI_ROOT = WORKSPACE_ROOT / "fortemi"
MAIN_RS = FORTEMI_ROOT / "crates/matric-api/src/main.rs"
OUTPUT_DIR = HOTM_ROOT / ".aiwg/api/compatibility"
JSON_OUT = OUTPUT_DIR / "fortemi-v2026-07-route-coverage.json"
MD_OUT = OUTPUT_DIR / "fortemi-v2026-07-route-coverage.md"
OP_JSON_OUT = OUTPUT_DIR / "fortemi-v2026-07-operation-coverage.json"
OP_MD_OUT = OUTPUT_DIR / "fortemi-v2026-07-operation-coverage.md"
EVIDENCE_MAP = OUTPUT_DIR / "fortemi-v2026-07-family-evidence-map.json"
OPERATION_EVIDENCE = HOTM_ROOT / ".aiwg/testing/data/fortemi-operation-conformance-v2026-07.json"
OPENAPI_CONTRACT = HOTM_ROOT / "ui/src/api/contracts/fortemi-openapi.yaml"
OPENAPI_RECEIPT = HOTM_ROOT / "ui/src/api/contracts/fortemi-openapi-receipt.json"
EXPECTED_ROUTE_COUNT = 202
EXPECTED_FAMILY_COUNT = 36
EXPECTED_STATUS_COUNTS = {
    "covered": 188,
    "documented_exclusion": 14,
}
HTTP_METHODS = ("get", "put", "post", "delete", "options", "head", "patch", "trace")
CONFORMANCE_DIMENSIONS = (
    "route",
    "request",
    "response",
    "auth_context",
    "ui",
    "agent",
    "live",
)
PASSING_DIMENSION_STATUSES = {"conformant", "not_applicable", "documented_exclusion"}
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


@dataclass(frozen=True)
class OpenApiOperation:
    method: str
    path: str
    operation_id: str
    family: str
    has_request_body: bool
    success_statuses: list[str]
    error_statuses: list[str]
    security: list[dict[str, list[str]]]
    route_disposition: str


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
    ("/livez", "health", "covered", "health checks in compat/core client", "#253"),
    ("/readyz", "health", "covered", "health checks in compat/core client", "#253"),
    ("/health", "health", "covered", "health checks in compat/core client", "#253"),
    ("/api/v1/operator/openapi.yaml", "contract_docs", "covered", "ui/src/api/systemCompatibility.ts fetches advertised OpenAPI and Admin API Surface links it", "#253"),
    ("/api/v1/operator/asyncapi.yaml", "contract_docs", "covered", "ui/src/api/systemCompatibility.ts fetches advertised AsyncAPI and Admin API Surface links it", "#253"),
    ("/openapi.yaml", "contract_docs", "covered", "ui/src/api/systemCompatibility.ts fetches advertised OpenAPI and Admin API Surface links it", "#253"),
    ("/asyncapi.yaml", "contract_docs", "covered", "ui/src/api/systemCompatibility.ts fetches advertised AsyncAPI and Admin API Surface links it", "#253"),
]


def sha256(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def stable_json(value: Any) -> str:
    return json.dumps(value, sort_keys=True, separators=(",", ":"))


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


def git_show_bytes(commit: str, path: str) -> bytes:
    return subprocess.check_output(
        ["git", "-C", str(FORTEMI_ROOT), "show", f"{commit}:{path}"],
        stderr=subprocess.DEVNULL,
    )


def fortemi_metadata() -> tuple[str, str]:
    commit = git_value(["rev-parse", "--short", "HEAD"], "unknown")
    latest_tag = git_value(["describe", "--tags", "--match", "v[0-9]*", "--abbrev=0"], "unknown")
    return commit, latest_tag


def load_json(path: Path) -> dict[str, Any]:
    with path.open(encoding="utf-8") as handle:
        value = json.load(handle)
    if not isinstance(value, dict):
        raise ValueError(f"{path} is not a JSON object")
    return value


def load_openapi(path: Path = OPENAPI_CONTRACT) -> dict[str, Any]:
    with path.open(encoding="utf-8") as handle:
        document = yaml.safe_load(handle)
    if not isinstance(document, dict):
        raise ValueError(f"{path} is not a YAML object")
    return document


def build_routes(source: str) -> list[ServerRoute]:
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
    return routes


def operation_key(method: str, path: str, operation_id: str) -> str:
    return f"{method.upper()} {path}#{operation_id}"


def extract_openapi_operations(document: dict[str, Any], routes: list[ServerRoute]) -> list[OpenApiOperation]:
    route_status = {
        (method, route.path): route.status
        for route in routes
        for method in route.methods
    }
    operations: list[OpenApiOperation] = []
    for path_name, path_item in sorted((document.get("paths") or {}).items()):
        if not isinstance(path_item, dict):
            continue
        for method in HTTP_METHODS:
            operation = path_item.get(method)
            if not isinstance(operation, dict):
                continue
            operation_id = operation.get("operationId")
            if not isinstance(operation_id, str) or not operation_id:
                operation_id = ""
            family, _, _, _ = classify(path_name)
            responses = operation.get("responses") if isinstance(operation.get("responses"), dict) else {}
            success_statuses = sorted(str(status) for status in responses if str(status).startswith("2"))
            error_statuses = sorted(str(status) for status in responses if not str(status).startswith("2"))
            security = operation.get("security")
            operations.append(
                OpenApiOperation(
                    method=method.upper(),
                    path=path_name,
                    operation_id=operation_id,
                    family=family,
                    has_request_body=isinstance(operation.get("requestBody"), dict),
                    success_statuses=success_statuses,
                    error_statuses=error_statuses,
                    security=security if isinstance(security, list) else [],
                    route_disposition=route_status.get((method.upper(), path_name), "not_in_route_inventory"),
                )
            )
    return operations


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


def build_route_diagnostics(summary: dict[str, object]) -> dict[str, object]:
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
        status_drift["route_count"] = {"expected": EXPECTED_ROUTE_COUNT, "actual": route_count}

    status_counts = summary["status_counts"]
    if not isinstance(status_counts, dict):
        evidence_issues.append("status_counts is not an object")
    elif status_counts != EXPECTED_STATUS_COUNTS:
        status_drift["status_counts"] = {"expected": EXPECTED_STATUS_COUNTS, "actual": status_counts}

    family_counts = summary["family_counts"]
    if not isinstance(family_counts, dict):
        evidence_issues.append("family_counts is not an object")
        family_counts = {}
    elif len(family_counts) != EXPECTED_FAMILY_COUNT:
        status_drift["family_count"] = {"expected": EXPECTED_FAMILY_COUNT, "actual": len(family_counts)}

    if not EVIDENCE_MAP.exists():
        evidence_issues.append(f"missing evidence map: {EVIDENCE_MAP.relative_to(HOTM_ROOT)}")
        return {
            "metadata_issues": metadata_issues,
            "unclassified_routes": unclassified_routes,
            "status_drift": {key: value for key, value in status_drift.items() if value is not None},
            "evidence_issues": evidence_issues,
        }

    evidence = load_json(EVIDENCE_MAP)
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


def build_pin_diagnostics(document: dict[str, Any], receipt: dict[str, Any], evidence: dict[str, Any]) -> list[str]:
    issues: list[str] = []
    supported_revisions = evidence.get("supported_contract_revisions")
    supported_versions = evidence.get("supported_contract_versions")
    contract_revision = document.get("x-fortemi-contract", {}).get("contract_revision")
    contract_version = document.get("info", {}).get("version")
    producer = receipt.get("producer", {})
    consumer = receipt.get("consumer", {})

    if document.get("openapi") != "3.1.0":
        issues.append(f"unsupported OpenAPI version: {document.get('openapi')}")
    if contract_revision not in supported_revisions or contract_revision not in consumer.get("acceptedContractRevisions", []):
        issues.append(f"unsupported OpenAPI contract revision: {contract_revision}")
    if contract_version not in supported_versions or contract_version not in consumer.get("acceptedContractVersions", []):
        issues.append(f"unsupported OpenAPI contract version: {contract_version}")
    if producer.get("contractRevision") != contract_revision:
        issues.append("OpenAPI receipt contract revision differs from vendored contract")
    if producer.get("contractVersion") != contract_version:
        issues.append("OpenAPI receipt contract version differs from vendored contract")

    contract_bytes = OPENAPI_CONTRACT.read_bytes()
    if sha256(contract_bytes) != producer.get("sha256"):
        issues.append("vendored OpenAPI checksum does not match receipt")

    commit = producer.get("commit")
    path = producer.get("path")
    if not isinstance(commit, str) or not commit or not isinstance(path, str) or not path:
        issues.append("OpenAPI receipt producer pin is incomplete")
    else:
        try:
            producer_bytes = git_show_bytes(commit, path)
            if sha256(producer_bytes) != producer.get("sha256") or producer_bytes != contract_bytes:
                issues.append("stale OpenAPI producer pin: pinned artifact differs from vendored contract")
        except (FileNotFoundError, subprocess.CalledProcessError):
            issues.append("stale OpenAPI producer pin: pinned artifact cannot be read from Fortemi checkout")
    return issues


def default_dimensions(operation: OpenApiOperation) -> dict[str, dict[str, Any]]:
    return {
        "route": {
            "status": "conformant" if operation.route_disposition != "not_in_route_inventory" else "gap",
            "evidence_paths": [],
            "notes": "Route disposition only; does not imply request, response, auth, UI, agent, or live conformance.",
        },
        "request": {"status": "gap", "evidence_paths": [], "notes": "No explicit request serializer evidence recorded."},
        "response": {"status": "gap", "evidence_paths": [], "notes": "No explicit success/error decoder evidence recorded."},
        "auth_context": {"status": "gap", "evidence_paths": [], "notes": "No explicit auth/context gate evidence recorded."},
        "ui": {"status": "gap", "evidence_paths": [], "notes": "No explicit UI workflow evidence recorded."},
        "agent": {"status": "gap", "evidence_paths": [], "notes": "No explicit agent workflow evidence recorded."},
        "live": {"status": "gap", "evidence_paths": [], "notes": "No live receipt recorded."},
    }


def merge_dimensions(operation: OpenApiOperation, override: dict[str, Any] | None) -> dict[str, dict[str, Any]]:
    dimensions = default_dimensions(operation)
    if not override:
        return dimensions
    raw_dimensions = override.get("dimensions", {})
    if not isinstance(raw_dimensions, dict):
        return dimensions
    for name, value in raw_dimensions.items():
        if name not in dimensions or not isinstance(value, dict):
            continue
        dimensions[name].update(value)
        dimensions[name]["evidence_paths"] = list(dimensions[name].get("evidence_paths") or [])
    return dimensions


def operation_status(dimensions: dict[str, dict[str, Any]], disposition: str | None) -> str:
    if disposition in {"documented_exclusion", "gap"}:
        return disposition
    required = ("route", "request", "response", "auth_context")
    if all(dimensions[name].get("status") in PASSING_DIMENSION_STATUSES for name in required):
        if any(dimensions[name].get("status") in PASSING_DIMENSION_STATUSES for name in ("ui", "agent", "live")):
            return "integrated"
        return "partial"
    if dimensions["route"].get("status") == "conformant":
        return "partial"
    return "gap"


def validate_evidence_paths(record: dict[str, Any]) -> list[str]:
    issues: list[str] = []
    op_key = record["key"]
    for dimension, meta in record["dimensions"].items():
        paths = meta.get("evidence_paths", [])
        if not isinstance(paths, list):
            issues.append(f"{op_key}: {dimension} evidence_paths is not a list")
            continue
        status = meta.get("status")
        if status == "conformant" and not paths and dimension != "route":
            issues.append(f"{op_key}: {dimension} is conformant without evidence_paths")
        for raw in paths:
            if not isinstance(raw, str):
                issues.append(f"{op_key}: {dimension} evidence path is not a string")
                continue
            if not (HOTM_ROOT / raw).exists():
                issues.append(f"{op_key}: missing {dimension} evidence path {raw}")
    return issues


def build_operation_summary(
    operations: list[OpenApiOperation],
    routes: list[ServerRoute],
    document: dict[str, Any],
    receipt: dict[str, Any],
    evidence: dict[str, Any],
) -> dict[str, Any]:
    evidence_operations = evidence.get("operations", {})
    if not isinstance(evidence_operations, dict):
        evidence_operations = {}
    route_keys = {operation_key(method, route.path, "") for route in routes for method in route.methods}
    records: list[dict[str, Any]] = []
    diagnostics = {
        "unclassified_operations": [],
        "missing_openapi_operations": [],
        "extra_evidence_operations": [],
        "evidence_issues": [],
        "pin_issues": build_pin_diagnostics(document, receipt, evidence),
        "boundary_issues": [],
    }
    seen_keys: set[str] = set()

    for operation in operations:
        key = operation_key(operation.method, operation.path, operation.operation_id)
        seen_keys.add(key)
        override = evidence_operations.get(key)
        dimensions = merge_dimensions(operation, override if isinstance(override, dict) else None)
        disposition = override.get("disposition") if isinstance(override, dict) else None
        tracker = override.get("tracker") if isinstance(override, dict) else "#290"
        rationale = override.get("rationale") if isinstance(override, dict) else "Operation-level conformance has not been explicitly claimed."
        record = {
            "key": key,
            "method": operation.method,
            "path": operation.path,
            "operation_id": operation.operation_id,
            "family": operation.family,
            "route_disposition": operation.route_disposition,
            "has_request_body": operation.has_request_body,
            "success_statuses": operation.success_statuses,
            "error_statuses": operation.error_statuses,
            "security": operation.security,
            "targeted_by_290": bool(isinstance(override, dict) and override.get("targeted_by_290")),
            "disposition": operation_status(dimensions, disposition if isinstance(disposition, str) else None),
            "tracker": tracker,
            "rationale": rationale,
            "dimensions": dimensions,
        }
        if operation.family == "unclassified" or not operation.operation_id:
            diagnostics["unclassified_operations"].append(record)
        if operation.route_disposition == "not_in_route_inventory" and operation_key(operation.method, operation.path, "") not in route_keys:
            diagnostics["boundary_issues"].append(f"{key}: OpenAPI operation is not present in route inventory")
        diagnostics["evidence_issues"].extend(validate_evidence_paths(record))
        records.append(record)

    diagnostics["extra_evidence_operations"] = sorted(set(evidence_operations) - seen_keys)
    diagnostics["missing_openapi_operations"] = sorted(
        key for key, value in evidence_operations.items()
        if isinstance(value, dict) and value.get("targeted_by_290") and key not in seen_keys
    )
    for key in diagnostics["extra_evidence_operations"]:
        diagnostics["evidence_issues"].append(f"{key}: evidence operation is not present in pinned OpenAPI")

    independent_boundaries = evidence.get("independent_boundaries", {})
    if not isinstance(independent_boundaries, dict):
        diagnostics["boundary_issues"].append("independent_boundaries is not an object")
    else:
        for boundary in ("route_inventory", "openapi", "asyncapi", "knowledge_shard", "compatibility", "auth"):
            if not independent_boundaries.get(boundary):
                diagnostics["boundary_issues"].append(f"missing independent boundary: {boundary}")

    return {
        "generated_at": date.today().isoformat(),
        "schema_version": 1,
        "source_issue": "Fortemi/HotM#290",
        "openapi": {
            "path": str(OPENAPI_CONTRACT.relative_to(HOTM_ROOT)),
            "receipt": str(OPENAPI_RECEIPT.relative_to(HOTM_ROOT)),
            "contract_revision": document.get("x-fortemi-contract", {}).get("contract_revision"),
            "contract_version": document.get("info", {}).get("version"),
            "producer_commit": receipt.get("producer", {}).get("commit"),
            "sha256": sha256(OPENAPI_CONTRACT.read_bytes()),
        },
        "operation_count": len(records),
        "targeted_operation_count": sum(1 for record in records if record["targeted_by_290"]),
        "disposition_counts": dict(Counter(record["disposition"] for record in records)),
        "dimension_counts": {
            dimension: dict(Counter(record["dimensions"][dimension]["status"] for record in records))
            for dimension in CONFORMANCE_DIMENSIONS
        },
        "family_counts": dict(Counter(record["family"] for record in records)),
        "operations": records,
        "verifier_diagnostics": diagnostics,
    }


def check_route_inventory(summary: dict[str, object]) -> list[str]:
    diagnostics = summary.get("verifier_diagnostics")
    if not isinstance(diagnostics, dict):
        diagnostics = build_route_diagnostics(summary)
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


def check_operation_inventory(summary: dict[str, Any]) -> list[str]:
    diagnostics = summary.get("verifier_diagnostics", {})
    errors: list[str] = []
    errors.extend(str(issue) for issue in diagnostics.get("pin_issues", []))
    errors.extend(str(issue) for issue in diagnostics.get("boundary_issues", []))
    errors.extend(str(issue) for issue in diagnostics.get("evidence_issues", []))
    for operation in diagnostics.get("unclassified_operations", []):
        if isinstance(operation, dict):
            errors.append(f"unclassified operation: {operation.get('method')} {operation.get('path')}#{operation.get('operation_id')}")
        else:
            errors.append(f"unclassified operation: {operation}")
    for key in diagnostics.get("missing_openapi_operations", []):
        errors.append(f"missing pinned OpenAPI operation: {key}")
    return errors


def render_route_markdown(summary: dict[str, Any], routes: list[ServerRoute]) -> str:
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
        f"- Fortemi commit: `{summary['fortemi_commit']}`",
        f"- Latest release tag: `{summary['fortemi_latest_tag']}`",
        f"- Extracted route declarations: `{len(routes)}`",
        "- Evidence boundary: route inventory is route-disposition evidence only.",
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
        lines.append(f"| `{methods}` | `{route.path}` | {route.family} | {route.status} | {route.hotm_evidence} | {route.tracker} |")
    lines.append("")
    return "\n".join(lines)


def render_operation_markdown(summary: dict[str, Any]) -> str:
    diagnostics = summary["verifier_diagnostics"]
    lines = [
        "---",
        "title: Fortemi v2026.7.1 Operation Coverage Inventory",
        "status: generated",
        f"date: {summary['generated_at']}",
        "artifact_type: api-operation-coverage-inventory",
        "related_issue: Fortemi/HotM#290",
        "---",
        "",
        "# Fortemi v2026.7.1 Operation Coverage Inventory",
        "",
        "This report is generated from the same data as the machine-readable operation coverage JSON. It keeps route inventory, OpenAPI, AsyncAPI, Knowledge Shard, compatibility, and auth boundaries independent.",
        "",
        f"- OpenAPI receipt: `{summary['openapi']['receipt']}`",
        f"- OpenAPI producer commit: `{summary['openapi']['producer_commit']}`",
        f"- Contract revision: `{summary['openapi']['contract_revision']}`",
        f"- Contract version: `{summary['openapi']['contract_version']}`",
        f"- Operations: `{summary['operation_count']}`",
        f"- Focused #290 operations: `{summary['targeted_operation_count']}`",
        "",
        "## Disposition Counts",
        "",
        "| Disposition | Count |",
        "| --- | ---: |",
    ]
    for status, count in sorted(summary["disposition_counts"].items()):
        lines.append(f"| {status} | {count} |")

    lines.extend(["", "## Dimension Counts", "", "| Dimension | Status counts |", "| --- | --- |"])
    for dimension in CONFORMANCE_DIMENSIONS:
        lines.append(f"| {dimension} | `{json.dumps(summary['dimension_counts'][dimension], sort_keys=True)}` |")

    lines.extend(
        [
            "",
            "## Verifier Diagnostics",
            "",
            "| Diagnostic | Count |",
            "| --- | ---: |",
            f"| Pin issues | {len(diagnostics['pin_issues'])} |",
            f"| Boundary issues | {len(diagnostics['boundary_issues'])} |",
            f"| Evidence issues | {len(diagnostics['evidence_issues'])} |",
            f"| Unclassified operations | {len(diagnostics['unclassified_operations'])} |",
            f"| Extra evidence operations | {len(diagnostics['extra_evidence_operations'])} |",
            f"| Missing OpenAPI operations | {len(diagnostics['missing_openapi_operations'])} |",
        ]
    )
    if any(diagnostics.values()):
        lines.extend(["", "### Diagnostic Details", ""])
        for key in ("pin_issues", "boundary_issues", "evidence_issues", "unclassified_operations", "extra_evidence_operations", "missing_openapi_operations"):
            value = diagnostics[key]
            if value:
                lines.append(f"- `{key}`: `{json.dumps(value, sort_keys=True)}`")

    lines.extend(
        [
            "",
            "## Focused #290 Operations",
            "",
            "| Method | Path | operationId | Family | Disposition | Route | Request | Response | Auth/context | UI | Agent | Live | Tracker |",
            "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
        ]
    )
    for record in summary["operations"]:
        if not record["targeted_by_290"]:
            continue
        dimensions = record["dimensions"]
        lines.append(
            f"| `{record['method']}` | `{record['path']}` | `{record['operation_id']}` | {record['family']} | {record['disposition']} | "
            f"{dimensions['route']['status']} | {dimensions['request']['status']} | {dimensions['response']['status']} | "
            f"{dimensions['auth_context']['status']} | {dimensions['ui']['status']} | {dimensions['agent']['status']} | {dimensions['live']['status']} | {record['tracker']} |"
        )

    lines.extend(
        [
            "",
            "## Operation Matrix",
            "",
            "| Method | Path | operationId | Family | Disposition | Route disposition | #290 target |",
            "| --- | --- | --- | --- | --- | --- | --- |",
        ]
    )
    for record in summary["operations"]:
        lines.append(
            f"| `{record['method']}` | `{record['path']}` | `{record['operation_id']}` | {record['family']} | {record['disposition']} | {record['route_disposition']} | {str(record['targeted_by_290']).lower()} |"
        )
    lines.append("")
    return "\n".join(lines)


def build_summaries() -> tuple[dict[str, Any], dict[str, Any], list[ServerRoute]]:
    source = MAIN_RS.read_text(encoding="utf-8")
    fortemi_commit, fortemi_latest_tag = fortemi_metadata()
    routes = build_routes(source)
    route_summary: dict[str, Any] = {
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
    route_summary["verifier_diagnostics"] = build_route_diagnostics(route_summary)

    document = load_openapi()
    receipt = load_json(OPENAPI_RECEIPT)
    evidence = load_json(OPERATION_EVIDENCE)
    operations = extract_openapi_operations(document, routes)
    operation_summary = build_operation_summary(operations, routes, document, receipt, evidence)
    return route_summary, operation_summary, routes


def write_reports(route_summary: dict[str, Any], operation_summary: dict[str, Any], routes: list[ServerRoute]) -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    JSON_OUT.write_text(json.dumps(route_summary, indent=2) + "\n", encoding="utf-8")
    MD_OUT.write_text(render_route_markdown(route_summary, routes), encoding="utf-8")
    OP_JSON_OUT.write_text(json.dumps(operation_summary, indent=2) + "\n", encoding="utf-8")
    OP_MD_OUT.write_text(render_operation_markdown(operation_summary), encoding="utf-8")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Generate and optionally validate HotM Fortemi route and operation coverage inventory."
    )
    parser.add_argument(
        "--check",
        action="store_true",
        help="Fail if generated route/operation metadata, pins, boundaries, or evidence paths are invalid.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    route_summary, operation_summary, routes = build_summaries()
    write_reports(route_summary, operation_summary, routes)

    print(f"wrote {JSON_OUT.relative_to(HOTM_ROOT)}")
    print(f"wrote {MD_OUT.relative_to(HOTM_ROOT)}")
    print(f"wrote {OP_JSON_OUT.relative_to(HOTM_ROOT)}")
    print(f"wrote {OP_MD_OUT.relative_to(HOTM_ROOT)}")
    print(stable_json({"route_status_counts": route_summary["status_counts"], "operation_disposition_counts": operation_summary["disposition_counts"]}))
    if args.check:
        errors = check_route_inventory(route_summary) + check_operation_inventory(operation_summary)
        if errors:
            for error in errors:
                print(f"check failed: {error}", file=sys.stderr)
            raise SystemExit(1)
        print("check passed: route inventory, operation coverage, pins, boundaries, and evidence paths are coherent")


if __name__ == "__main__":
    main()
