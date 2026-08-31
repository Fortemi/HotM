#!/usr/bin/env python3

from __future__ import annotations

import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
VERIFIER = ROOT / "scripts/ci/verify-container-release-policy.py"


class ContainerReleasePolicyTests(unittest.TestCase):
    def setUp(self) -> None:
        self.tempdir = tempfile.TemporaryDirectory()
        self.root = Path(self.tempdir.name)
        (self.root / ".gitea/workflows").mkdir(parents=True)
        (self.root / "ui").mkdir()
        for relative in (
            ".gitea/workflows/publish-hotm-ui-image.yml",
            ".gitea/workflows/ui-ci.yml",
            "ui/package.json",
        ):
            shutil.copy2(ROOT / relative, self.root / relative)

    def tearDown(self) -> None:
        self.tempdir.cleanup()

    def run_verifier(self) -> subprocess.CompletedProcess[str]:
        return subprocess.run(
            ["python3", str(VERIFIER), str(self.root)],
            cwd=ROOT,
            check=False,
            text=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
        )

    def mutate(self, relative: str, old: str, new: str) -> None:
        path = self.root / relative
        text = path.read_text()
        self.assertIn(old, text)
        path.write_text(text.replace(old, new, 1))

    def test_current_policy_passes(self) -> None:
        result = self.run_verifier()
        self.assertEqual(result.returncode, 0, result.stderr)

    def test_branch_trigger_fails_closed(self) -> None:
        self.mutate(
            ".gitea/workflows/publish-hotm-ui-image.yml",
            "  push:\n    tags: ['v*']",
            "  push:\n    branches: [main]\n    tags: ['v*']",
        )
        result = self.run_verifier()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("must not have a branch trigger", result.stderr)

    def test_bundle_commit_tag_fails_closed(self) -> None:
        self.mutate(
            ".gitea/workflows/publish-hotm-ui-image.yml",
            '${GITEA_BUNDLE}:${VERSION}"',
            '${GITEA_BUNDLE}:sha-${GITHUB_SHA}"',
        )
        result = self.run_verifier()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("rolling or commit tags", result.stderr)

    def test_non_calver_package_version_fails_closed(self) -> None:
        self.mutate("ui/package.json", '"version": "2026.7.1"', '"version": "dev"')
        result = self.run_verifier()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("not YYYY.M.P CalVer", result.stderr)

    def test_retired_proxy_dev_publisher_fails_closed(self) -> None:
        path = self.root / ".gitea/workflows/ui-ci.yml"
        path.write_text(
            path.read_text()
            + "\n  publish-dev:\n"
            + "    if: github.ref == 'refs/heads/main'\n"
            + "    steps: []\n"
        )
        result = self.run_verifier()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("retired branch container publication", result.stderr)


if __name__ == "__main__":
    unittest.main()
