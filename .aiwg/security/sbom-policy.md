# Software Bill of Materials (SBOM) Policy

**Issue:** #55
**Status:** Implemented
**Last Updated:** 2026-01-31

## Overview

HotM generates Software Bill of Materials (SBOM) for all frontend builds to provide transparency about third-party dependencies and enable vulnerability tracking.

## SBOM Format

**Standard:** CycloneDX 1.4+
**Format:** JSON
**Tool:** `@cyclonedx/cyclonedx-npm`

## Generation

SBOMs are automatically generated during CI/CD pipeline execution:

```yaml
# .github/workflows/frontend-tests.yml
- name: Generate SBOM
  run: |
    cd ui
    npx @cyclonedx/cyclonedx-npm --output-file sbom.json

- name: Upload SBOM
  uses: actions/upload-artifact@v4
  with:
    name: sbom
    path: ui/sbom.json
    retention-days: 90
```

## SBOM Artifacts

| Artifact | Location | Retention | Purpose |
|----------|----------|-----------|---------|
| Frontend SBOM | `ui/sbom.json` | 90 days | Track npm dependencies |
| Backend SBOM | TBD (future) | 90 days | Track Rust crates |

## SBOM Contents

The SBOM includes:

1. **Component Inventory**
   - Package name and version
   - License information
   - Package URLs (PURL)
   - Dependency tree

2. **Metadata**
   - Build timestamp
   - Tool information
   - Component hashes

3. **Dependency Graph**
   - Direct dependencies
   - Transitive dependencies
   - Dependency relationships

## Usage Scenarios

### Vulnerability Management

**Monitor Known Vulnerabilities:**
```bash
# Download SBOM from GitHub Actions artifacts
gh run download <run-id> -n sbom

# Check against vulnerability databases
grype sbom:sbom.json
```

**Track CVEs:**
```bash
# Use SBOM for CVE tracking
syft packages file:sbom.json -o json | jq '.artifacts[] | select(.vulnerabilities)'
```

### License Compliance

**Generate License Report:**
```bash
# Extract license information
jq '.components[] | {name: .name, version: .version, license: .licenses[0].license.id}' sbom.json
```

**Identify License Risks:**
```bash
# Find copyleft licenses (GPL, AGPL, etc.)
jq '.components[] | select(.licenses[0].license.id | test("GPL|AGPL"))' sbom.json
```

### Supply Chain Security

**Verify Component Integrity:**
```bash
# Check if components have known security issues
osv-scanner --sbom sbom.json
```

**Track Dependency Changes:**
```bash
# Compare SBOMs across releases
diff <(jq -S . sbom-v0.1.0.json) <(jq -S . sbom-v0.1.1.json)
```

## Integration with Security Scanning

SBOMs integrate with existing security tools:

1. **Dependency Scanning:** `npm audit` uses package-lock.json
2. **Vulnerability Databases:** SBOM enables third-party scanning (Grype, Trivy, OSV-Scanner)
3. **Supply Chain Attacks:** SBOM provides baseline for detecting unauthorized changes

## SBOM Validation

**Verify SBOM Integrity:**
```bash
# Validate CycloneDX format
cyclonedx-cli validate --input-file sbom.json --input-format json
```

**Check Completeness:**
```bash
# Ensure SBOM includes all dependencies
npm list --all --json | jq '.dependencies | keys' > actual-deps.txt
jq '.components[].name' sbom.json > sbom-deps.txt
diff actual-deps.txt sbom-deps.txt
```

## Retention and Archival

| Environment | Retention Period | Storage |
|-------------|------------------|---------|
| CI Artifacts | 90 days | GitHub Actions |
| Release Assets | Permanent | GitHub Releases |
| Production Builds | 1 year | S3/artifact registry |

## SBOM Distribution

**Public Releases:**
- Attach SBOM to GitHub Release assets
- Include in MSI installer metadata (future)

**Internal Use:**
- Download from CI artifacts
- Store in security scanning platform

## Automation

**Scheduled SBOM Refresh:**
```yaml
# .github/workflows/sbom-weekly.yml (future)
name: Weekly SBOM Update
on:
  schedule:
    - cron: '0 0 * * 0'  # Every Sunday at midnight
jobs:
  generate-sbom:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Generate fresh SBOM
        run: npx @cyclonedx/cyclonedx-npm --output-file sbom.json
      - name: Upload to S3
        run: aws s3 cp sbom.json s3://hotm-sboms/$(date +%Y%m%d)-sbom.json
```

## Policy Requirements

### For Pull Requests

- ✅ SBOM generation MUST succeed
- ✅ No high/critical vulnerabilities in new dependencies
- ✅ License compatibility verified

### For Releases

- ✅ SBOM attached to GitHub Release
- ✅ SBOM validated against CycloneDX schema
- ✅ Vulnerability scan results included

## Tools and Standards

| Tool | Purpose | Version |
|------|---------|---------|
| CycloneDX NPM | SBOM generation | Latest |
| Grype | Vulnerability scanning | Latest |
| OSV-Scanner | Open source vulnerability DB | Latest |
| Syft | SBOM analysis | Latest |

**Standards Compliance:**
- NTIA Minimum Elements for SBOM (2021)
- CycloneDX Specification 1.4+
- SPDX 2.3+ (alternative format - future)

## Future Enhancements

1. **Backend SBOM:** Add Cargo SBOM generation (`cargo-cyclonedx`)
2. **SBOM Signing:** Cryptographically sign SBOMs with GPG
3. **Continuous Monitoring:** Automated vulnerability alerts from SBOM
4. **Supply Chain Levels:** SLSA compliance tracking
5. **SBOM Comparison:** Automated diff between versions

## References

- [NTIA SBOM Minimum Elements](https://www.ntia.gov/files/ntia/publications/sbom_minimum_elements_report.pdf)
- [CycloneDX Specification](https://cyclonedx.org/specification/overview/)
- [CISA SBOM Guidance](https://www.cisa.gov/sbom)
- [OWASP Dependency-Check](https://owasp.org/www-project-dependency-check/)

## Related Documentation

- `.aiwg/security/dependency-scanning.md` (future)
- `.aiwg/security/supply-chain-security.md` (future)
- `.aiwg/operations/vulnerability-management.md` (future)

## Audit Trail

| Date | Change | Author |
|------|--------|--------|
| 2026-01-31 | Initial SBOM policy created | Claude Code |
| 2026-01-31 | CI pipeline integration (#55) | Claude Code |
