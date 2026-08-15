---
title: Fortemi Route Coverage Operation-Conformance Test Report
status: generated
date: 2026-08-15
artifact_type: executable-test-report
related_issue: Fortemi/HotM#290
---

# Fortemi Route Coverage Operation-Conformance Test Report

## Test Context

- **Code to test**: `.aiwg/testing/scripts/fortemi-route-coverage.py`
- **Testing framework**: Python `unittest` plus stdlib `trace`
- **Coverage target**: 80% line coverage for the focused Python verifier target
- **Test types needed**: unit tests, fixture validation, negative verifier diagnostics
- **External dependencies mocked**: Fortemi pinned Git producer reads via `git_show_bytes`
- **Edge cases covered**: route-family evidence not inferred as conformance, explicit #290 operation gaps, missing evidence paths, unsupported revisions, stale producer pins, stale evidence operation keys, generated JSON/Markdown parity

## Commands

```bash
python3 -m unittest discover -s .aiwg/testing/scripts -p 'test_*.py' -v
python3 .aiwg/testing/scripts/fortemi-route-coverage.py --check
python3 -m trace --count --summary --missing --coverdir .aiwg/evidence/fortemi-route-coverage-trace-2026-08-15 --module unittest discover -s .aiwg/testing/scripts -p 'test_*.py' -v
```

## Results

- Unit tests: 7 passed.
- Generator check: passed.
- Trace coverage for `.aiwg/testing/scripts/fortemi-route-coverage.py`: 85.6%.
- Trace output directory: `.aiwg/evidence/fortemi-route-coverage-trace-2026-08-15/`.

## Generated Reports

- `.aiwg/api/compatibility/fortemi-v2026-07-route-coverage.json`
- `.aiwg/api/compatibility/fortemi-v2026-07-route-coverage.md`
- `.aiwg/api/compatibility/fortemi-v2026-07-operation-coverage.json`
- `.aiwg/api/compatibility/fortemi-v2026-07-operation-coverage.md`
