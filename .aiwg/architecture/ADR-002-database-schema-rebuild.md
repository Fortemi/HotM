# ADR-002: Greenfield Database Schema Rebuild Strategy

**Status**: Accepted
**Date**: 2025-12-04
**Context**: HotM v0.1.0 Alpha - Pre-production development
**Deciders**: Development Team

## Decision

Use a **greenfield "clean schema rebuild" approach** for development and testing, consolidating all migrations into a single schema file that can be rapidly deployed and reset. Keep migration files for historical reference and CI validation, but optimize developer workflow for fast iteration rather than production data safety.

## Context

### Project Phase
- **Version**: 0.1.0 Alpha
- **Status**: Pre-production, active development
- **Data**: No production data to preserve
- **Priority**: Fast iteration and testing

### Current Migration State

HotM uses 6 migrations to evolve the PostgreSQL schema:

1. **0001_complete_mvp_schema.sql** (456 lines)
   - Core tables: note, note_original, note_revised_current, note_revision
   - Organization: collection, tag, note_tag
   - Relationships: link, provenance_edge
   - Search: embedding (pgvector), full-text search indexes
   - Jobs: job_queue, job_history with enums
   - Metadata: user_metadata_label, user_config, activity_log
   - Functions: estimate_job_duration, update_note_access, triggers
   - Views: job_queue_status, all_tags_view (materialized), archived_notes_view
   - Extensions: pgvector, uuid-ossp

2. **0002_add_progress_message.sql**
   - Add `progress_message TEXT` to job_queue for WebSocket updates

3. **0003_add_job_logs.sql**
   - Add `logs TEXT[]` to job_queue and job_history
   - Add `idx_job_queue_completed_at` index
   - Add `cleanup_old_jobs()` function (keep last 100 jobs)

4. **0004_add_link_metadata.sql**
   - Add `metadata JSONB` to link table
   - Add GIN index for link metadata

5. **0005_add_title_generation.sql**
   - Add `title TEXT` to note table
   - Add `idx_note_title` index
   - Add `title_generation` to job_type enum

6. **0006_add_revision_model.sql**
   - Add `model TEXT` to note_revision table
   - Backfill existing AI revisions with 'gpt-oss:20b'

### Pain Points with Current Approach

1. **Testing Requires Clean State**: Integration tests need pristine database
2. **Migration Churn**: Small schema changes require new migration files
3. **Slow Reset**: Running 6 migrations sequentially is slower than single schema file
4. **Developer Friction**: `sqlx migrate run` every time database needs reset
5. **No Data to Preserve**: Pre-production means no migration path needed (yet)

### Technology Constraints

- **SQLx**: Uses migrations for compile-time query verification
- **PostgreSQL**: Requires pgvector extension before vector columns
- **CI/CD**: GitHub Actions runs full migration suite for validation

## Clean Schema Approach

### Architecture

```
scripts/schema/
├── clean-schema.sql       # Consolidated schema (all migrations)
├── rebuild-schema.sh      # Linux/WSL rebuild script
├── rebuild-schema.ps1     # Windows PowerShell rebuild script
└── README.md              # Developer guide

server/migrations/         # Kept for historical reference & CI validation
├── 0001_*.sql
├── 0002_*.sql
...
└── 0006_*.sql
```

### Consolidated Schema File

**scripts/schema/clean-schema.sql** contains:

1. **Extensions** (pgvector, uuid-ossp)
2. **Enums** (job_status, job_type with all values)
3. **Tables** (all 17 tables with all columns from all migrations)
4. **Indexes** (all performance indexes including FTS, GIN, partial)
5. **Functions** (all 6 functions including triggers)
6. **Views** (job_queue_status, all_tags_view, archived_notes_view)
7. **Triggers** (update_original_edited, track_revision_user_edit)
8. **Default Data** (user_config defaults)
9. **Comments** (documentation for tables/columns)

### Rebuild Scripts

**Linux/WSL (rebuild-schema.sh)**:
```bash
#!/bin/bash
set -e

# 1. Test database connection
psql "$DATABASE_URL" -c "SELECT 1;"

# 2. Drop all tables (CASCADE)
psql "$DATABASE_URL" <<EOF
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO PUBLIC;
EOF

# 3. Recreate extensions (must be before schema)
psql "$DATABASE_URL" <<EOF
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
EOF

# 4. Execute clean schema
psql "$DATABASE_URL" -f scripts/schema/clean-schema.sql

# 5. Verify tables created
psql "$DATABASE_URL" -c "\dt"
```

**Windows PowerShell (rebuild-schema.ps1)**:
- Equivalent logic with PowerShell syntax
- Uses `psql` command-line client
- Error handling with $ErrorActionPreference

### Developer Workflows

**Quick Reset for Testing:**
```bash
# Linux/WSL
export DATABASE_URL=postgres://hotm:pass@localhost:5432/hotm_dev
./scripts/schema/rebuild-schema.sh

# Windows
$env:DATABASE_URL='postgres://hotm:pass@localhost:5432/hotm_dev'
.\scripts\schema\rebuild-schema.ps1
```

**Daily Development:**
```bash
# 1. Reset database
./scripts/schema/rebuild-schema.sh

# 2. Run server (no migrations needed)
cd server
cargo run

# 3. Run tests
gh act -j backend-tests
```

**Schema Evolution (Development Phase):**
```bash
# 1. Update clean-schema.sql directly
vim scripts/schema/clean-schema.sql

# 2. Test with rebuild
./scripts/schema/rebuild-schema.sh

# 3. Create matching migration for CI (optional)
# Keeps SQLx happy, but not actively used in dev
touch server/migrations/0007_new_feature.sql

# 4. Update SQLx prepared queries
cd server
cargo sqlx prepare
```

## SQLx Compatibility

### Challenge
SQLx uses migrations for offline mode (`cargo sqlx prepare`) and expects migrations to be the source of truth.

### Solution

**Development (Now)**:
- Use clean-schema.sql for local development
- Run `cargo sqlx prepare` after schema changes to update `.sqlx/query-*.json`
- Migrations exist but aren't actively run in dev

**CI/CD**:
- GitHub Actions runs `sqlx migrate run` for validation
- Ensures migrations still work (even if not used locally)
- Catches migration drift from clean schema

**Workflow**:
```bash
# After updating clean-schema.sql
./scripts/schema/rebuild-schema.sh
cd server
cargo sqlx prepare  # Update .sqlx/ with new schema
```

### Migration Drift Prevention

To keep migrations in sync with clean schema:

1. **Manual Sync**: Update both clean-schema.sql and add new migration
2. **CI Check**: Run migrations in CI to catch drift
3. **Future Tool**: Script to generate migration from clean-schema diff

## Evolution Strategy

### Phase 1: Development (Current)

**Approach**: Greenfield rebuild
**Duration**: Until beta or production prep

**Workflow**:
- Update `clean-schema.sql` directly
- Rebuild database with script
- Create matching migrations for CI validation
- Fast iteration, no rollback complexity

**Pros**:
- Extremely fast database resets
- Simple mental model (one file)
- No migration ordering concerns
- Perfect for testing

**Cons**:
- Migrations may drift from clean schema
- No rollback capability (acceptable for dev)
- Requires manual sync between clean schema and migrations

### Phase 2: Pre-Production (Future)

**Trigger**: Approaching beta release, early adopters
**Change**: Switch back to migration-based approach

**Workflow**:
- Start using `sqlx migrate run` in development
- Create new migrations for all schema changes
- Test migration path from clean schema
- Develop rollback procedures

**Rationale**: Early adopters may have data to preserve

### Phase 3: Production (Future)

**Trigger**: v1.0 release, production deployments
**Change**: Full migration-based with strict controls

**Workflow**:
- All schema changes via migrations
- Rollback script for each migration
- Zero-downtime migration strategies
- Data safety critical

**Features Needed**:
- Backup before migrate
- Transaction-wrapped migrations
- Rollback procedures tested
- Canary deployments

## Consequences

### Advantages

1. **Fast Testing**: Database reset in <2 seconds vs ~5 seconds with migrations
2. **Simple Debugging**: One file to review for full schema
3. **Easy Schema Review**: All tables/indexes in one place
4. **Rapid Iteration**: No migration file churn during development
5. **Clean State Guarantee**: Every rebuild is identical
6. **Reduced Friction**: Fewer commands to remember

### Disadvantages

1. **No Rollback**: Can't undo schema changes (acceptable for dev)
2. **Migration Drift Risk**: Clean schema may diverge from migrations
3. **Manual Sync**: Must update both clean schema and migrations
4. **Lost History**: Schema evolution not visible in one file (but migrations still exist)
5. **CI Complexity**: Must validate both approaches work

### Mitigation Strategies

**Migration Drift**:
- CI runs `sqlx migrate run` to catch drift
- Monthly review: compare clean schema to migration result
- Future: Automated diff tool

**Lost History**:
- Keep all migration files in server/migrations/
- Add comments in clean-schema.sql referencing migration numbers
- Git history shows schema evolution

**Rollback**:
- Not needed in development (can rebuild)
- Will implement when approaching production

## Implementation Checklist

- [x] Create scripts/schema/ directory
- [x] Consolidate all migrations into clean-schema.sql
- [x] Create rebuild-schema.sh (Linux/WSL)
- [x] Create rebuild-schema.ps1 (Windows)
- [x] Add scripts/schema/README.md with usage guide
- [x] Document ADR-002
- [ ] Update CLAUDE.md with schema rebuild instructions
- [ ] Test rebuild scripts on Linux and Windows
- [ ] Verify SQLx offline mode after rebuild
- [ ] Update CI to validate both approaches
- [ ] Add seed data script (optional)

## References

- **Migrations**: `/home/manitcor/dev/hotm/server/migrations/`
- **Clean Schema**: `/home/manitcor/dev/hotm/scripts/schema/clean-schema.sql`
- **Rebuild Scripts**: `/home/manitcor/dev/hotm/scripts/schema/rebuild-schema.{sh,ps1}`
- **SQLx Documentation**: https://github.com/launchbadge/sqlx/tree/main/sqlx-cli

## Decision Log

- **2025-12-04**: Initial decision - Greenfield approach for development phase
- **Future**: Review before beta release for migration strategy
- **Future**: Review before production for rollback procedures

## Success Metrics

- **Developer Time**: <5 seconds for full database rebuild
- **Test Reliability**: 100% consistent schema across test runs
- **CI Validation**: Both clean schema and migrations pass in CI
- **Migration Drift**: Detected and resolved within 1 sprint
- **Developer Satisfaction**: Feedback from team on workflow

## When to Revisit

1. **Beta Release Approaching**: Switch to migration-based for early adopters
2. **Production Deployment**: Implement full rollback procedures
3. **Team Growth**: If migration drift becomes frequent issue
4. **Data Preservation**: When users have data worth preserving
5. **Schema Stability**: When schema changes become infrequent

---

**Approved by**: Development Team
**Implementation Date**: 2025-12-04
**Review Date**: Before beta release or 2025-Q2 (whichever comes first)
