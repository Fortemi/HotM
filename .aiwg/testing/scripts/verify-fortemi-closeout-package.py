#!/usr/bin/env python3
"""Verify the Fortemi v2026.7.1 HotM SDLC closeout packet."""

from __future__ import annotations

import json
import re
import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[3]

ROUTE_JSON = ROOT / ".aiwg/api/compatibility/fortemi-v2026-07-route-coverage.json"
OPENAPI_RECEIPT = ROOT / "ui/src/api/contracts/fortemi-openapi-receipt.json"
WORKFLOW = ROOT / ".gitea/workflows/sdlc-gates.yml"
PUBLISHER = ROOT / ".aiwg/scripts/publish-fortemi-tracker-comments.py"

EXPECTED_COUNTS = {
    "route_count": 204,
    "family_count": 36,
    "covered": 190,
    "documented_exclusion": 14,
    "gap": 0,
    "partial": 0,
    "decision_needed": 0,
}

REQUIRED_ARTIFACTS = [
    ".aiwg/api/compatibility/fortemi-v2026-07-route-coverage.md",
    ".aiwg/api/compatibility/fortemi-v2026-07-route-coverage.json",
    ".aiwg/api/compatibility/fortemi-v2026-07-family-evidence-map.json",
    ".aiwg/requirements/fortemi-api-integration-requirements-2026-07.md",
    ".aiwg/requirements/fortemi-v2026-07-ux-workflow-scenarios.md",
    ".aiwg/architecture/adr/ADR-010-fortemi-v2026-07-api-coverage.md",
    ".aiwg/architecture/adr/ADR-011-fortemi-media-call-surface-disposition.md",
    ".aiwg/architecture/sad-fortemi-integration-addendum-2026-07.md",
    ".aiwg/design/fortemi-v2026-07-capability-surface-matrix.md",
    ".aiwg/design/fortemi-v2026-07-api-client-implementation-blueprint.md",
    ".aiwg/design/fortemi-v2026-07-agent-tool-coverage-matrix.md",
    ".aiwg/design/fortemi-v2026-07-ux-integration-addendum.md",
    ".aiwg/planning/fortemi-v2026-07-hotm-integration-plan.md",
    ".aiwg/planning/fortemi-v2026-07-implementation-roadmap.md",
    ".aiwg/planning/fortemi-v2026-07-issue-dependency-map.md",
    ".aiwg/testing/api-contract-test-plan-addendum-2026-07.md",
    ".aiwg/testing/fortemi-v2026-07-scenario-test-matrix.md",
    ".aiwg/testing/fortemi-v2026-07-fixture-catalog.md",
    ".aiwg/testing/fortemi-route-verifier-spec-2026-07.md",
    ".aiwg/testing/fortemi-route-verifier-ci-adoption-2026-07.md",
    ".aiwg/security/fortemi-v2026-07-security-redaction-controls.md",
    ".aiwg/risks/fortemi-v2026-07-integration-risk-register.md",
    ".aiwg/reports/fortemi-v2026-07-api-integration-traceability.md",
    ".aiwg/reports/fortemi-v2026-07-artifact-index.md",
    ".aiwg/reports/fortemi-v2026-07-completion-audit.md",
    ".aiwg/reports/fortemi-v2026-07-coverage-evidence-audit.md",
    ".aiwg/reports/fortemi-v2026-07-delivery-evidence-ledger.md",
    ".aiwg/reports/fortemi-v2026-07-mcp-tool-surface-audit.md",
    ".aiwg/reports/fortemi-v2026-07-remote-baseline-revalidation.md",
    ".aiwg/reports/fortemi-v2026-07-tracker-publication-receipts.md",
    ".aiwg/gates/fortemi-api-integration-gate-2026-07-14.md",
    ".aiwg/handoffs/fortemi-v2026-07-discovery-to-delivery-handoff.md",
    ".aiwg/handoffs/fortemi-v2026-07-tracker-publication-backlog.md",
    ".aiwg/handoffs/fortemi-v2026-07-pr-closeout-package.md",
    ".aiwg/scripts/publish-fortemi-tracker-comments.py",
    ".aiwg/testing/scripts/verify-fortemi-route-inventory.sh",
    ".aiwg/testing/scripts/verify-fortemi-closeout-package.py",
    ".gitea/workflows/sdlc-gates.yml",
]

ISSUES = ["242", "243", "247", "253", "254", "255", "256", "257", "258", "259"]
STALE_PATTERNS = [
    "155 covered",
    "31 partial",
    "covered | 155",
    "partial | 31",
    "classifies them as 155",
]


def fail(message: str) -> None:
    print(f"error: {message}", file=sys.stderr)
    raise SystemExit(1)


def read(path: str | Path) -> str:
    return (ROOT / path if isinstance(path, str) else path).read_text()


def assert_exists() -> None:
    missing = [path for path in REQUIRED_ARTIFACTS if not (ROOT / path).exists()]
    if missing:
        fail("missing required closeout artifacts: " + ", ".join(missing))


def assert_route_inventory() -> None:
    data = json.loads(ROUTE_JSON.read_text())
    receipt = json.loads(OPENAPI_RECEIPT.read_text())
    status_counts = data.get("status_counts", {})
    diagnostics = data.get("verifier_diagnostics", {})
    checks = {
        "route_count": data.get("route_count"),
        "family_count": len(data.get("family_counts", {})),
        "covered": status_counts.get("covered", 0),
        "documented_exclusion": status_counts.get("documented_exclusion", 0),
        "gap": status_counts.get("gap", 0),
        "partial": status_counts.get("partial", 0),
        "decision_needed": status_counts.get("decision_needed", 0),
    }
    for key, expected in EXPECTED_COUNTS.items():
        if checks.get(key) != expected:
            fail(f"route inventory {key} expected {expected}, got {checks.get(key)}")
    producer_commit = receipt.get("producer", {}).get("commit")
    if not producer_commit:
        fail("OpenAPI receipt is missing its exact producer commit")
    if data.get("fortemi_commit") != producer_commit[:8]:
        fail(
            "route inventory producer differs from OpenAPI receipt: "
            f"expected {producer_commit[:8]}, got {data.get('fortemi_commit')}"
        )
    for key, value in diagnostics.items():
        if value:
            fail(f"route verifier diagnostics not clean: {key}={value}")


def assert_artifact_index_links() -> None:
    index = read(".aiwg/reports/fortemi-v2026-07-artifact-index.md")
    for path in REQUIRED_ARTIFACTS:
        if path == ".aiwg/reports/fortemi-v2026-07-artifact-index.md":
            continue
        if path.startswith(".aiwg/testing/scripts/verify-fortemi-closeout-package.py"):
            continue
        if path.startswith(".gitea/"):
            continue
        if path not in index:
            fail(f"artifact index does not reference {path}")


def assert_cross_links() -> None:
    closeout = ".aiwg/handoffs/fortemi-v2026-07-pr-closeout-package.md"
    remote = ".aiwg/reports/fortemi-v2026-07-remote-baseline-revalidation.md"
    for path in [
        ".aiwg/gates/fortemi-api-integration-gate-2026-07-14.md",
        ".aiwg/reports/fortemi-v2026-07-completion-audit.md",
        ".aiwg/reports/fortemi-v2026-07-artifact-index.md",
    ]:
        text = read(path)
        if closeout not in text:
            fail(f"{path} does not reference PR closeout package")
        if remote not in text:
            fail(f"{path} does not reference remote baseline revalidation")


def assert_pr_closeout() -> None:
    text = read(".aiwg/handoffs/fortemi-v2026-07-pr-closeout-package.md")
    for section in ["## PR Title", "## PR Body", "## Validation", "## Remaining External Closure"]:
        if section not in text:
            fail(f"PR closeout package missing {section}")
    for issue in ISSUES:
        if f"#{issue}" not in text:
            fail(f"PR closeout package missing issue #{issue}")
    for phrase in [
        "202 Fortemi routes",
        "188 covered routes",
        "14 documented exclusions",
        "0 gap routes",
        "0 partial routes",
        "0 decision-needed routes",
    ]:
        if phrase not in text:
            fail(f"PR closeout package missing route summary phrase: {phrase}")


def assert_tracker_receipts() -> None:
    text = read(".aiwg/reports/fortemi-v2026-07-tracker-publication-receipts.md")
    expected = {
        "242": "85222",
        "247": "85223",
        "253": "85224",
        "254": "85225",
        "255": "85226",
        "256": "85231",
        "257": "85232",
        "258": "85233",
        "259": "85234",
        "243": "85235",
    }
    for issue, comment_id in expected.items():
        if f"#{issue}" not in text:
            fail(f"tracker receipts missing issue #{issue}")
        if comment_id not in text:
            fail(f"tracker receipts missing comment {comment_id} for issue #{issue}")
    if "PUBLISHED" not in text:
        fail("tracker receipts artifact does not record published status")


def assert_workflow() -> None:
    text = WORKFLOW.read_text()
    for phrase in [
        "fortemi-route-inventory",
        "Verify Fortemi route inventory",
        "verify-fortemi-route-inventory.sh",
        "Verify Fortemi closeout package",
        "verify-fortemi-closeout-package.py",
    ]:
        if phrase not in text:
            fail(f"workflow missing {phrase}")


def assert_no_stale_baseline() -> None:
    roots = [
        ROOT / ".aiwg/requirements",
        ROOT / ".aiwg/architecture",
        ROOT / ".aiwg/design",
        ROOT / ".aiwg/testing",
        ROOT / ".aiwg/planning",
        ROOT / ".aiwg/risks",
        ROOT / ".aiwg/reports",
        ROOT / ".aiwg/handoffs",
        ROOT / ".aiwg/gates",
    ]
    hits: list[str] = []
    for root in roots:
        for path in root.rglob("*.md"):
            text = path.read_text()
            for pattern in STALE_PATTERNS:
                if pattern in text:
                    hits.append(f"{path.relative_to(ROOT)}: {pattern}")
    if hits:
        fail("stale route baseline text found: " + "; ".join(hits))


def assert_tracker_dry_run() -> None:
    result = subprocess.run(
        [str(PUBLISHER)],
        cwd=ROOT,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        check=False,
    )
    if result.returncode != 0:
        fail(f"tracker publisher dry-run failed: {result.stderr.strip()}")
    if "dry-run: 10 comments ready for Fortemi/HotM" not in result.stdout:
        fail("tracker publisher dry-run did not report 10 prepared comments")
    for issue in ISSUES:
        if f"#{issue}:" not in result.stdout:
            fail(f"tracker publisher dry-run missing issue #{issue}")


def main() -> None:
    assert_exists()
    assert_route_inventory()
    assert_artifact_index_links()
    assert_cross_links()
    assert_pr_closeout()
    assert_tracker_receipts()
    assert_workflow()
    assert_no_stale_baseline()
    assert_tracker_dry_run()
    print(
        "verified Fortemi closeout package: "
        f"artifacts=present links=coherent routes={EXPECTED_COUNTS['route_count']} "
        f"covered={EXPECTED_COUNTS['covered']} "
        "documented_exclusions=14 tracker_comments=10"
    )


if __name__ == "__main__":
    main()
