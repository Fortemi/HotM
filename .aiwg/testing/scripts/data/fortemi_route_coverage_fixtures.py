"""Factories and fixtures for fortemi-route-coverage.py tests."""

from __future__ import annotations

from copy import deepcopy
from pathlib import Path
from typing import Any

import yaml


ROOT = Path(__file__).resolve().parents[4]
OPENAPI_PATH = ROOT / "ui/src/api/contracts/fortemi-openapi.yaml"
RECEIPT_PATH = ROOT / "ui/src/api/contracts/fortemi-openapi-receipt.json"


def operation_fixture(overrides: dict[str, Any] | None = None) -> dict[str, Any]:
    base = {
        "post": {
            "operationId": "fixture_create_widget",
            "security": [{"bearerAuth": []}],
            "requestBody": {
                "required": True,
                "content": {"application/json": {"schema": {"type": "object"}}},
            },
            "responses": {
                "201": {"description": "Created"},
                "400": {"description": "Bad request"},
                "429": {"description": "Rate limited"},
            },
        }
    }
    if overrides:
        base["post"].update(overrides)
    return base


def openapi_fixture(paths: dict[str, Any] | None = None, revision: str = "1") -> dict[str, Any]:
    return {
        "openapi": "3.1.0",
        "info": {"title": "Fixture Fortemi API", "version": "2026.2.9"},
        "x-fortemi-contract": {"contract_revision": revision},
        "paths": paths or {"/api/v1/widgets": operation_fixture()},
    }


def receipt_fixture(contract_bytes: bytes, revision: str = "1") -> dict[str, Any]:
    import hashlib

    digest = hashlib.sha256(contract_bytes).hexdigest()
    return {
        "producer": {
            "commit": "fixture-pin",
            "path": "contracts/openapi/openapi.yaml",
            "sha256": digest,
            "contractRevision": revision,
            "contractVersion": "2026.2.9",
        },
        "consumer": {
            "acceptedContractRevisions": ["1"],
            "acceptedContractVersions": ["2026.2.9"],
        },
    }


def evidence_fixture(operations: dict[str, Any] | None = None) -> dict[str, Any]:
    return {
        "supported_contract_revisions": ["1"],
        "supported_contract_versions": ["2026.2.9"],
        "independent_boundaries": {
            "route_inventory": ".aiwg/api/compatibility/fortemi-v2026-07-route-coverage.json",
            "openapi": "ui/src/api/contracts/fortemi-openapi-receipt.json",
            "asyncapi": ".aiwg/testing/scripts/verify-fortemi-event-catalog.mjs",
            "knowledge_shard": ".aiwg/testing/scripts/verify-fortemi-knowledge-shard-contract.mjs",
            "compatibility": ".aiwg/testing/scripts/verify-fortemi-system-compatibility-contract.mjs",
            "auth": "agent-proxy/src/auth/fixtures/fortemi-auth-v1.json",
        },
        "operations": deepcopy(operations or {}),
    }


def real_openapi_subset(path_name: str, method: str) -> dict[str, Any]:
    document = yaml.safe_load(OPENAPI_PATH.read_text(encoding="utf-8"))
    return {path_name: {method.lower(): deepcopy(document["paths"][path_name][method.lower()])}}
