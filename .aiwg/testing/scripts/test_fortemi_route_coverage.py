from __future__ import annotations

import importlib.util
import json
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

import yaml

SCRIPT_PATH = Path(__file__).with_name("fortemi-route-coverage.py")
DATA_DIR = Path(__file__).with_name("data")
sys.path.insert(0, str(DATA_DIR))

from fortemi_route_coverage_fixtures import (  # noqa: E402
    evidence_fixture,
    openapi_fixture,
    operation_fixture,
    receipt_fixture,
    real_openapi_subset,
)


spec = importlib.util.spec_from_file_location("fortemi_route_coverage", SCRIPT_PATH)
coverage = importlib.util.module_from_spec(spec)
assert spec.loader is not None
sys.modules["fortemi_route_coverage"] = coverage
spec.loader.exec_module(coverage)


class FortemiOperationCoverageTests(unittest.TestCase):
    def test_extracts_method_path_operation_id_without_route_conformance_inference(self) -> None:
        document = openapi_fixture({
            "/api/v1/inference/complete": real_openapi_subset("/api/v1/inference/complete", "post")["/api/v1/inference/complete"]
        })
        routes = [
            coverage.ServerRoute(
                methods=["POST"],
                path="/api/v1/inference/complete",
                handler_expr="post(complete)",
                family="inference",
                status="covered",
                hotm_evidence="route family only",
                tracker="#253",
            )
        ]

        operations = coverage.extract_openapi_operations(document, routes)
        summary = coverage.build_operation_summary(
            operations,
            routes,
            document,
            receipt_fixture(yaml.safe_dump(document).encode("utf-8")),
            evidence_fixture(),
        )
        record = summary["operations"][0]

        self.assertEqual(record["operation_id"], "complete")
        self.assertEqual(record["route_disposition"], "covered")
        self.assertEqual(record["dimensions"]["route"]["status"], "conformant")
        self.assertEqual(record["dimensions"]["request"]["status"], "gap")
        self.assertEqual(record["dimensions"]["response"]["status"], "gap")
        self.assertEqual(record["disposition"], "partial")

    def test_explicit_focused_gap_overrides_covered_family(self) -> None:
        key = "POST /api/v1/inference/complete#complete"
        document = openapi_fixture({
            "/api/v1/inference/complete": real_openapi_subset("/api/v1/inference/complete", "post")["/api/v1/inference/complete"]
        })
        routes = [
            coverage.ServerRoute(
                methods=["POST"],
                path="/api/v1/inference/complete",
                handler_expr="post(complete)",
                family="inference",
                status="covered",
                hotm_evidence="route family only",
                tracker="#253",
            )
        ]
        evidence = evidence_fixture({
            key: {
                "targeted_by_290": True,
                "disposition": "gap",
                "tracker": "#290",
                "rationale": "No typed direct completion client.",
                "dimensions": {
                    "route": {"status": "conformant", "evidence_paths": []},
                    "request": {"status": "gap", "evidence_paths": []},
                    "response": {"status": "gap", "evidence_paths": []},
                    "auth_context": {"status": "gap", "evidence_paths": []},
                    "ui": {"status": "gap", "evidence_paths": []},
                    "agent": {"status": "gap", "evidence_paths": []},
                    "live": {"status": "gap", "evidence_paths": []},
                },
            }
        })

        summary = coverage.build_operation_summary(
            coverage.extract_openapi_operations(document, routes),
            routes,
            document,
            receipt_fixture(yaml.safe_dump(document).encode("utf-8")),
            evidence,
        )

        self.assertEqual(summary["targeted_operation_count"], 1)
        self.assertEqual(summary["operations"][0]["disposition"], "gap")
        self.assertEqual(summary["operations"][0]["tracker"], "#290")

    def test_missing_evidence_path_is_a_check_failure(self) -> None:
        key = "POST /api/v1/widgets#fixture_create_widget"
        document = openapi_fixture()
        routes = [
            coverage.ServerRoute(
                methods=["POST"],
                path="/api/v1/widgets",
                handler_expr="post(create_widget)",
                family="widgets",
                status="covered",
                hotm_evidence="fixture",
                tracker="#290",
            )
        ]
        evidence = evidence_fixture({
            key: {
                "targeted_by_290": True,
                "disposition": "partial",
                "tracker": "#290",
                "rationale": "fixture",
                "dimensions": {
                    "request": {"status": "conformant", "evidence_paths": ["missing/request-client.ts"]},
                },
            }
        })

        summary = coverage.build_operation_summary(
            coverage.extract_openapi_operations(document, routes),
            routes,
            document,
            receipt_fixture(yaml.safe_dump(document).encode("utf-8")),
            evidence,
        )
        errors = coverage.check_operation_inventory(summary)

        self.assertTrue(any("missing request evidence path missing/request-client.ts" in error for error in errors))

    def test_unsupported_contract_revision_and_stale_pin_are_check_failures(self) -> None:
        document = openapi_fixture(revision="99")
        evidence = evidence_fixture()
        contract_bytes = yaml.safe_dump(document).encode("utf-8")
        receipt = receipt_fixture(contract_bytes, revision="99")

        class FakeContractPath:
            def read_bytes(self) -> bytes:
                return contract_bytes

        with patch.object(coverage, "OPENAPI_CONTRACT", FakeContractPath()):
            with patch.object(coverage, "git_show_bytes", return_value=b"different producer bytes"):
                issues = coverage.build_pin_diagnostics(document, receipt, evidence)

        self.assertIn("unsupported OpenAPI contract revision: 99", issues)
        self.assertIn("stale OpenAPI producer pin: pinned artifact differs from vendored contract", issues)

    def test_stale_operation_projection_is_a_check_failure(self) -> None:
        document = openapi_fixture()
        evidence = evidence_fixture()
        contract_bytes = yaml.safe_dump(document).encode("utf-8")
        receipt = receipt_fixture(contract_bytes)
        projection = {
            "openapi": {"sha256": "0" * 64},
            "operation_count": 2,
            "operations": [{}],
        }

        class FakeContractPath:
            def read_bytes(self) -> bytes:
                return contract_bytes

        with patch.object(coverage, "OPENAPI_CONTRACT", FakeContractPath()):
            with patch.object(coverage, "git_show_bytes", return_value=contract_bytes):
                issues = coverage.build_pin_diagnostics(
                    document, receipt, evidence, projection
                )

        self.assertIn("stale OpenAPI operation projection: source checksum differs", issues)
        self.assertIn("OpenAPI operation projection count is inconsistent", issues)

    def test_extra_target_evidence_operation_is_a_check_failure(self) -> None:
        document = openapi_fixture()
        routes: list[coverage.ServerRoute] = []
        evidence = evidence_fixture({
            "GET /api/v1/not-real#not_real": {
                "targeted_by_290": True,
                "disposition": "gap",
                "tracker": "#290",
                "rationale": "fixture stale key",
                "dimensions": {},
            }
        })

        summary = coverage.build_operation_summary(
            coverage.extract_openapi_operations(document, routes),
            routes,
            document,
            receipt_fixture(yaml.safe_dump(document).encode("utf-8")),
            evidence,
        )
        errors = coverage.check_operation_inventory(summary)

        self.assertIn("missing pinned OpenAPI operation: GET /api/v1/not-real#not_real", errors)
        self.assertTrue(any("evidence operation is not present in pinned OpenAPI" in error for error in errors))

    def test_generated_real_reports_share_operation_data(self) -> None:
        route_summary, operation_summary, routes = coverage.build_summaries()
        route_markdown = coverage.render_route_markdown(route_summary, routes)
        markdown = coverage.render_operation_markdown(operation_summary)

        self.assertEqual(operation_summary["source_issue"], "Fortemi/HotM#290")
        self.assertEqual(operation_summary["operation_count"], 251)
        self.assertGreaterEqual(operation_summary["targeted_operation_count"], 30)
        self.assertEqual(operation_summary["dimension_counts"]["agent"]["conformant"], 12)
        create_job = next(
            record for record in operation_summary["operations"]
            if record["operation_id"] == "create_job"
        )
        self.assertEqual(create_job["disposition"], "partial")
        self.assertEqual(create_job["dimensions"]["live"]["status"], "gap")
        self.assertIn("Route Matrix", route_markdown)
        self.assertIn("Evidence boundary: route inventory is route-disposition evidence only", route_markdown)
        self.assertIn("`POST` | `/api/v1/inference/complete`", markdown)
        self.assertIn("Focused #290 Operations", markdown)
        self.assertEqual(coverage.check_route_inventory(route_summary), [])
        self.assertEqual(coverage.check_operation_inventory(operation_summary), [])
        self.assertEqual(route_summary["route_count"], len(routes))

    def test_static_scenario_fixture_is_valid_json(self) -> None:
        scenarios = json.loads((DATA_DIR / "fortemi-route-coverage-test-scenarios.json").read_text(encoding="utf-8"))

        self.assertGreaterEqual(len(scenarios["scenarios"]), 4)
        self.assertTrue(all("name" in scenario and "description" in scenario for scenario in scenarios["scenarios"]))


if __name__ == "__main__":
    unittest.main()
