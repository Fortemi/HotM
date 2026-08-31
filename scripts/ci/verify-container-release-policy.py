#!/usr/bin/env python3
"""Fail closed when HotM container publication drifts from release-only CalVer."""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path


ROOT = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else Path(__file__).resolve().parents[2]
IMAGE_WORKFLOW = ROOT / ".gitea/workflows/publish-hotm-ui-image.yml"
CI_WORKFLOW = ROOT / ".gitea/workflows/ui-ci.yml"
PACKAGE_JSON = ROOT / "ui/package.json"
CALVER_RE = re.compile(r"^[0-9]{4}\.(?:[1-9]|1[0-2])\.[0-9]+$")


def workflow_header(text: str) -> str:
    return text.split("\njobs:", maxsplit=1)[0]


def job_block(text: str, name: str) -> str:
    match = re.search(
        rf"^  {re.escape(name)}:\s*$\n(?P<body>.*?)(?=^  [A-Za-z0-9_-]+:\s*$|\Z)",
        text,
        re.MULTILINE | re.DOTALL,
    )
    return match.group(0) if match else ""


def main() -> int:
    failures: list[str] = []
    try:
        image_workflow = IMAGE_WORKFLOW.read_text()
        ci_workflow = CI_WORKFLOW.read_text()
        declared_version = json.loads(PACKAGE_JSON.read_text())["version"]
    except (OSError, KeyError, json.JSONDecodeError) as error:
        print(f"container release policy check failed: {error}", file=sys.stderr)
        return 1

    image_header = workflow_header(image_workflow)
    image_job = job_block(image_workflow, "build-and-push")
    if re.search(r"^\s+branches:\s*", image_header, re.MULTILINE):
        failures.append("publish-hotm-ui-image.yml must not have a branch trigger")
    if "tags: ['v*']" not in image_header:
        failures.append("publish-hotm-ui-image.yml must retain the v* release trigger")
    if "if: startsWith(github.ref, 'refs/tags/v')" not in image_job:
        failures.append("HotM image publication must have a release-ref job guard")
    if "mode=rolling" in image_job or "sha-${" in image_job or "SHORT_SHA" in image_job:
        failures.append("HotM image publication must not emit rolling or commit tags")

    required_calver_fragments = (
        r"^v[0-9]{4}\.([1-9]|1[0-2])\.[0-9]+$",
        'VERSION="${GITHUB_REF_NAME#v}"',
        "DECLARED_VERSION=$(jq -er '.version' ui/package.json)",
        'if [ "${VERSION}" != "${DECLARED_VERSION}" ]; then',
    )
    for fragment in required_calver_fragments:
        if fragment not in image_job:
            failures.append(f"HotM image publication is missing CalVer control: {fragment}")

    required_tag_sets = (
        'UI_TAGS="${GHCR_UI}:latest,${GHCR_UI}:${VERSION},${GITEA_UI}:latest,${GITEA_UI}:${VERSION}"',
        'BUNDLE_TAGS="${GHCR_BUNDLE}:latest,${GHCR_BUNDLE}:${VERSION},${GITEA_BUNDLE}:latest,${GITEA_BUNDLE}:${VERSION}"',
    )
    for tag_set in required_tag_sets:
        if tag_set not in image_job:
            failures.append(f"HotM image publication is missing symmetric release tags: {tag_set}")

    if not CALVER_RE.fullmatch(str(declared_version)):
        failures.append(f"ui/package.json version is not YYYY.M.P CalVer: {declared_version}")

    if job_block(ci_workflow, "publish-dev"):
        failures.append("ui-ci.yml still defines retired branch container publication")
    proxy_release = job_block(ci_workflow, "publish-release")
    required_proxy_fragments = (
        "github.event_name == 'create'",
        "startsWith(github.ref, 'refs/tags/v')",
        r"^v[0-9]{4}\.([1-9]|1[0-2])\.[0-9]+$",
        "DECLARED_VERSION=$(jq -er '.version' ui/package.json)",
    )
    for fragment in required_proxy_fragments:
        if fragment not in proxy_release:
            failures.append(f"agent-proxy release is missing release control: {fragment}")
    if "sha-${" in proxy_release or "SHORT_SHA" in proxy_release:
        failures.append("agent-proxy release must not emit commit tags")

    if failures:
        print("HotM container release policy check failed.", file=sys.stderr)
        for failure in failures:
            print(f"- {failure}", file=sys.stderr)
        return 1

    print("HotM container release policy check passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
