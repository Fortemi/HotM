# HotM Database Schema Management

This directory contains the greenfield schema management approach for HotM development.

## Quick Start

### Reset Database to Clean State

**Linux/WSL:**
```bash
export DATABASE_URL=postgres://user:pass@localhost:5432/hotm_dev
./scripts/schema/rebuild-schema.sh
```

**Windows PowerShell:**
```powershell
$env:DATABASE_URL='postgres://user:pass@localhost:5432/hotm_dev'
.\scripts\schema\rebuild-schema.ps1
```

## Files

- **clean-schema.sql** - Consolidated schema from migrations 0001-0006
- **rebuild-schema.sh** - Linux/WSL rebuild script
- **rebuild-schema.ps1** - Windows PowerShell rebuild script
- **README.md** - This file

## Architecture Decision

This approach is documented in `.aiwg/architecture/ADR-002-database-schema-rebuild.md`.

**Why Greenfield?**
- Fast iteration during development
- Easy testing with clean state
- No migration complexity (yet)
- Pre-production project with no data to preserve

**When to Switch?**
- Before production deployment
- When data migration becomes necessary
- When rollback capability is required

## Usage Patterns

### Daily Development
```bash
# Quick reset for testing
./scripts/schema/rebuild-schema.sh

# Run server (migrations still work for CI)
cd server
cargo run
```

### Testing Workflow
```bash
# Reset before each test run
./scripts/schema/rebuild-schema.sh

# Run integration tests
gh act -j backend-tests
```

### Schema Evolution

**Development Phase (Now):**
- Update `clean-schema.sql` directly
- Test with rebuild script
- Keep migrations in sync (for SQLx compatibility)

**Pre-Production:**
- Start using migrations again
- Create new migration files for changes
- Test migration path

**Production:**
- Full migration-based approach
- Rollback procedures required
- Data safety critical

## SQLx Compatibility

The clean schema approach works with SQLx:

1. **Offline Mode**: Run `cargo sqlx prepare` after schema changes
2. **CI Validation**: `sqlx migrate run` verifies migrations still work
3. **Local Dev**: Use clean schema for speed

## Migration History

**0001_complete_mvp_schema.sql** - Base tables, indexes, functions, views
**0002_add_progress_message.sql** - Job progress messages for WebSocket
**0003_add_job_logs.sql** - Job logs array, cleanup function
**0004_add_link_metadata.sql** - Link metadata JSONB column
**0005_add_title_generation.sql** - Note title column and job type
**0006_add_revision_model.sql** - Track generation model in revisions

All consolidated into `clean-schema.sql` for greenfield rebuilds.

## Safety Notes

- Rebuild script is DESTRUCTIVE - all data is lost
- Always confirm before running
- Use TEST database for experiments
- Keep production credentials separate

## Future Enhancements

- Seed data script for common test scenarios
- Snapshot/restore for faster resets
- Migration generator from clean schema diff
