## Test Context

- **Code to test**: `.aiwg/testing/scripts/fortemi-route-coverage.py`
- **Testing framework**: Python `unittest`
- **Coverage target**: minimum 80% for the focused operation-conformance paths in this script
- **Test types needed**: unit tests for extraction/classification/diagnostics, fixture validation for generated reports
- **External dependencies to mock**: Fortemi pinned Git artifact reads via `git_show_bytes`
- **Edge cases identified**: unclassified operation IDs, missing evidence paths, unsupported OpenAPI revisions, stale producer pins, route-disposed operations without explicit conformance evidence, focused #290 gap classifications

## Scenario Coverage

The tests in `test_fortemi_route_coverage.py` verify that operation-level coverage is derived from pinned OpenAPI operations plus explicit evidence data. They intentionally avoid treating route-family coverage or source-file presence as proof of request, response, auth/context, UI, agent, or live conformance.

## Fixtures And Factories

- `fortemi_route_coverage_fixtures.py` provides dynamic OpenAPI, receipt, and evidence factories.
- `fortemi-route-coverage-test-scenarios.json` documents deterministic negative and positive scenarios.
- `unittest.mock` stubs Fortemi Git producer artifact reads so stale-pin paths can be tested without mutating the sibling checkout.
