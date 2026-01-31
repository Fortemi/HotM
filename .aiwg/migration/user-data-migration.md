# User Data Migration Guide: Desktop to SPA

**Status**: Approved
**Version**: 1.0
**Last Updated**: 2026-01-31
**Target Release**: v0.2.0

---

## Overview

This guide documents the migration path for existing HotM desktop application users transitioning to the new web-based Single Page Application (SPA) architecture. The migration moves user data from local PostgreSQL databases to the centralized matric-memory API server.

### Architecture Change Summary

| Aspect | Desktop (Before) | SPA (After) |
|--------|------------------|-------------|
| **Client** | Tauri desktop app (Windows 11) | React SPA (any browser) |
| **Storage** | Local PostgreSQL database | matric-memory API (remote server) |
| **NLP Processing** | Local Ollama service | Server-side Ollama (matric-memory) |
| **Access** | Desktop-only (Windows) | Web-accessible (any device) |
| **Data Location** | User's local machine | matric-memory server |
| **Authentication** | None (single-user) | OIDC via Keycloak (multi-user) |

## Data Location Changes

### Before: Desktop Architecture

```
┌─────────────────────┐
│  Tauri Desktop UI   │  Windows 11 native
│  React + TypeScript │
└──────────┬──────────┘
           │ HTTP (localhost:53211)
           ↓
┌─────────────────────┐
│   HotM API Server   │  Rust Axum server
│   (localhost)       │  Running on user's machine
└──────┬──────────────┘
       │
       ↓
┌────────────────────┐
│ PostgreSQL (local) │  User's local database
│ Port 5432 or 5433  │  - Notes (immutable originals)
│                    │  - Revisions (AI-enhanced)
│                    │  - Embeddings (vectors)
│                    │  - Tags, collections
│                    │  - Provenance history
└────────────────────┘
```

**Key Characteristics**:
- All data stored on user's machine
- Full offline access
- No network dependency
- Single-user only
- Privacy via local-first architecture

### After: SPA Architecture

```
┌─────────────────────┐
│   React SPA (Web)   │  Any browser, any device
│  TypeScript + Vite  │  Deployed via Nginx
└──────────┬──────────┘
           │ HTTPS
           ↓
┌─────────────────────┐
│ matric-memory API   │  Production REST API
│   (Remote Server)   │  Shared multi-user backend
└──────────┬──────────┘
           │
           ↓
┌─────────────────────┐
│ PostgreSQL (server) │  Server-side database
│ + Ollama (server)   │  - All user notes
│                     │  - Shared NLP processing
│                     │  - Multi-tenant data
└─────────────────────┘
```

**Key Characteristics**:
- Data stored on matric-memory server
- Web access from any device
- Network-dependent
- Multi-user with authentication
- Privacy via server access control

## Migration Steps for Existing Users

### Prerequisites

1. **Active HotM Desktop Installation**: Ensure you have access to your current HotM desktop app with data
2. **matric-memory API Access**: Obtain credentials for matric-memory server
3. **Network Connection**: Required for data upload
4. **Backup**: Create a backup of your local PostgreSQL database before proceeding

### Step 1: Export Notes from Desktop App

#### Option A: Database Export (PostgreSQL)

Export your local HotM database to a SQL dump file:

```bash
# Find your DATABASE_URL (typically in environment or HotM config)
# Default: postgres://hotm:hotm_dev_pass@localhost:5433/hotm_dev

# Export all data
pg_dump -U hotm -h localhost -p 5433 hotm_dev > hotm_backup_$(date +%Y%m%d).sql

# Export only user data (excludes system tables)
pg_dump -U hotm -h localhost -p 5433 hotm_dev \
  --table=notes \
  --table=revisions \
  --table=embeddings \
  --table=tags \
  --table=note_tags \
  --table=collections \
  --table=note_collections \
  --table=links \
  --table=provenance \
  > hotm_user_data_$(date +%Y%m%d).sql
```

#### Option B: JSON Export (API-based)

Use the desktop HotM API to export notes as JSON:

```bash
# Ensure desktop HotM server is running (localhost:53211)

# Export all notes to JSON
curl http://localhost:53211/api/v1/notes?export=true > notes_export.json

# Export with full metadata
curl http://localhost:53211/api/v1/notes?export=full > notes_full_export.json
```

**Export Data Structure** (JSON format):

```json
{
  "export_version": "1.0",
  "export_date": "2026-01-31T10:00:00Z",
  "notes_count": 150,
  "notes": [
    {
      "id": "uuid-1234",
      "original_content": "# My Note\nOriginal markdown content...",
      "revised_content": "# My Note\nAI-enhanced content...",
      "tags": ["project", "idea"],
      "collection": "Work Notes",
      "created_at": "2025-12-01T12:00:00Z",
      "updated_at": "2025-12-05T15:30:00Z",
      "embedding": [0.123, -0.456, ...],
      "provenance": [
        {
          "version": 1,
          "content": "Original text",
          "timestamp": "2025-12-01T12:00:00Z"
        }
      ],
      "links": [
        {
          "type": "internal",
          "target_note_id": "uuid-5678",
          "context": "Related to project planning"
        }
      ]
    }
  ]
}
```

### Step 2: Transform Data for matric-memory API

The matric-memory API uses a compatible but slightly different schema. Use the provided transformation script:

```bash
# Install migration tools
npm install -g @hotm/migration-tools

# Transform desktop export to matric-memory format
hotm-migrate transform \
  --input notes_export.json \
  --output matric_import.json \
  --format matric-memory-v1

# Validate transformed data
hotm-migrate validate matric_import.json
```

**Schema Mapping**:

| Desktop HotM Field | matric-memory Field | Notes |
|-------------------|---------------------|-------|
| `id` | `id` | UUID preserved |
| `original_content` | `content` | Original becomes primary content |
| `revised_content` | `metadata.revised_content` | Stored as metadata |
| `tags` | `tags` | Direct mapping |
| `collection` | `collection` | Direct mapping |
| `embedding` | `embedding` | Vector preserved (1536 dimensions) |
| `created_at` | `created_at` | ISO 8601 timestamp |
| `updated_at` | `updated_at` | ISO 8601 timestamp |
| `provenance` | `metadata.provenance` | Stored as metadata array |

### Step 3: Import to matric-memory API

#### Authentication Setup

1. Log in to matric-memory web interface
2. Generate an API key: Settings → API Keys → Create New Key
3. Copy the API key (shown only once)

```bash
# Set API credentials
export MATRIC_API_URL="https://matric-memory.example.com/api/v1"
export MATRIC_API_KEY="your-api-key-here"
```

#### Bulk Import

Use the migration tool to import data:

```bash
# Dry-run (validate without importing)
hotm-migrate import \
  --input matric_import.json \
  --api-url $MATRIC_API_URL \
  --api-key $MATRIC_API_KEY \
  --dry-run

# Actual import
hotm-migrate import \
  --input matric_import.json \
  --api-url $MATRIC_API_URL \
  --api-key $MATRIC_API_KEY \
  --batch-size 50 \
  --progress

# Import log saved to: migration_log_20260131.json
```

#### Manual Import (Alternative)

For small datasets, use the matric-memory API directly:

```bash
# Import single note
curl -X POST $MATRIC_API_URL/notes \
  -H "Authorization: Bearer $MATRIC_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "# My Note\nOriginal content...",
    "tags": ["project", "idea"],
    "collection": "Work Notes"
  }'

# Bulk import (batch of notes)
curl -X POST $MATRIC_API_URL/notes/bulk \
  -H "Authorization: Bearer $MATRIC_API_KEY" \
  -H "Content-Type: application/json" \
  -d @matric_import.json
```

### Step 4: Verify Data Integrity

After import, verify all data migrated successfully:

```bash
# Generate verification report
hotm-migrate verify \
  --source notes_export.json \
  --api-url $MATRIC_API_URL \
  --api-key $MATRIC_API_KEY \
  --output verification_report.json

# Check report for discrepancies
cat verification_report.json
```

**Verification Checks**:

1. **Note Count**: Total notes matches source export
2. **Content Integrity**: Original content preserved exactly
3. **Tags**: All tags assigned correctly
4. **Collections**: Collection assignments preserved
5. **Links**: Internal note links maintained (UUIDs updated if needed)
6. **Embeddings**: Semantic search vectors present and valid
7. **Timestamps**: Created/updated dates preserved
8. **Provenance**: Revision history complete

**Expected Output**:

```json
{
  "status": "success",
  "source_notes": 150,
  "imported_notes": 150,
  "failed_imports": 0,
  "verification_time": "2026-01-31T10:30:00Z",
  "checks": {
    "content_integrity": "PASS",
    "tag_assignment": "PASS",
    "collection_assignment": "PASS",
    "link_integrity": "PASS",
    "embedding_presence": "PASS",
    "timestamp_preservation": "PASS"
  },
  "warnings": [],
  "errors": []
}
```

### Step 5: Access Web SPA

Once data is migrated, access the new HotM SPA:

1. Navigate to `https://hotm.example.com`
2. Log in with your matric-memory credentials (OIDC)
3. Verify all notes are visible
4. Test search functionality (hybrid and semantic)
5. Verify tags and collections are accessible
6. Check note linking works correctly

## Data Format Compatibility

### Markdown Preservation

Both desktop HotM and matric-memory use standard Markdown for note content. All formatting is preserved:

- Headings (`#`, `##`, `###`)
- Lists (ordered and unordered)
- Code blocks (fenced with ` ``` `)
- Links (`[text](url)`)
- Images (`![alt](url)`)
- Tables
- Blockquotes
- Emphasis (`*italic*`, `**bold**`)

### Tag Format

Tags are case-insensitive and automatically normalized:

- Desktop: `["Project", "IDEA", "work"]`
- matric-memory: `["project", "idea", "work"]`

Multi-word tags are preserved with hyphens:

- Desktop: `["project-planning", "deep-work"]`
- matric-memory: `["project-planning", "deep-work"]`

### Link Preservation

Internal note links are preserved during migration:

**Desktop Format**:
```markdown
See related note: [[note-uuid-1234]]
```

**matric-memory Format**:
```markdown
See related note: [Note Title](/notes/note-uuid-1234)
```

The migration tool automatically converts internal link syntax.

### Embedding Compatibility

Both systems use identical embedding models and vector dimensions:

- **Model**: `nomic-embed-text` (Ollama)
- **Dimensions**: 1536
- **Similarity**: Cosine similarity for semantic search

Embeddings are directly transferred without recomputation. If embeddings are missing, matric-memory will regenerate them automatically.

## Rollback Procedure

If migration fails or you need to return to the desktop app:

### Step 1: Restore Local Database

```bash
# Stop HotM desktop server (if running)
# Restore from SQL backup
dropdb -U hotm hotm_dev
createdb -U hotm hotm_dev
psql -U hotm -d hotm_dev < hotm_backup_20260131.sql

# Verify restoration
psql -U hotm -d hotm_dev -c "SELECT COUNT(*) FROM notes;"
```

### Step 2: Restart Desktop HotM

```bash
# Ensure Ollama is running
ollama list

# Start HotM server
cd /path/to/hotm/server
export DATABASE_URL="postgres://hotm:hotm_dev_pass@localhost:5433/hotm_dev"
cargo run

# Start desktop UI
cd /path/to/hotm/ui
npm run tauri dev
```

### Step 3: Verify Desktop Data

1. Open HotM desktop app
2. Verify note count matches pre-migration state
3. Test search and NLP features
4. Check tags and collections

### Partial Rollback (Keep Both)

You can maintain both desktop and web versions during transition:

1. Keep desktop HotM installed with local data
2. Use web SPA for new notes
3. Gradually migrate additional data as needed
4. Decommission desktop once confident in web version

**Note**: Changes made in the web SPA will not sync back to desktop PostgreSQL. Desktop remains frozen at migration snapshot.

## Migration Timeline

### Recommended Schedule

| Phase | Duration | Actions |
|-------|----------|---------|
| **Preparation** | 1 week | - Test export tools<br>- Verify backup procedures<br>- Review migration guide |
| **Pilot Migration** | 1 week | - Migrate 10-20 test notes<br>- Verify data integrity<br>- Test web SPA functionality |
| **Full Migration** | 1-2 days | - Export all notes<br>- Transform and import<br>- Verify complete dataset |
| **Validation** | 1 week | - Parallel usage (desktop + web)<br>- Compare search results<br>- Verify all features work |
| **Cutover** | 1 day | - Finalize web SPA as primary<br>- Decommission desktop (optional)<br>- Archive local database |

### Cutover Date

**Target Date**: TBD (to be announced)

**Pre-Cutover Checklist**:
- [ ] Migration tools tested and validated
- [ ] Backup procedures documented
- [ ] User credentials for matric-memory created
- [ ] Full data export completed
- [ ] Test import successful (pilot data)
- [ ] Verification report reviewed and approved
- [ ] Web SPA access confirmed
- [ ] Support resources available (docs, contact)

**Post-Cutover Support**:
- First 2 weeks: Daily check-ins for issues
- Month 1: Weekly verification reports
- Ongoing: Issue tracking via GitHub

## Troubleshooting

### Export Issues

**Problem**: `pg_dump` fails with authentication error

**Solution**:
```bash
# Verify PostgreSQL credentials
psql -U hotm -h localhost -p 5433 -d hotm_dev -c "SELECT version();"

# Update .pgpass file (Linux/macOS)
echo "localhost:5433:hotm_dev:hotm:hotm_dev_pass" >> ~/.pgpass
chmod 600 ~/.pgpass

# Or use PGPASSWORD environment variable
PGPASSWORD=hotm_dev_pass pg_dump -U hotm -h localhost -p 5433 hotm_dev > backup.sql
```

**Problem**: API export returns empty JSON

**Solution**:
```bash
# Verify desktop HotM server is running
curl http://localhost:53211/api/v1/health

# Check note count
curl http://localhost:53211/api/v1/notes | jq '.notes | length'

# Export with verbose logging
curl -v http://localhost:53211/api/v1/notes?export=true
```

### Import Issues

**Problem**: Bulk import fails with 401 Unauthorized

**Solution**:
```bash
# Verify API key is valid
curl -H "Authorization: Bearer $MATRIC_API_KEY" \
  $MATRIC_API_URL/auth/verify

# Regenerate API key if expired
# Login to matric-memory web UI → Settings → API Keys → Revoke Old → Create New
```

**Problem**: Import succeeds but note count doesn't match

**Solution**:
```bash
# Check migration log for errors
cat migration_log_20260131.json | jq '.errors'

# Re-import failed notes only
hotm-migrate import \
  --input matric_import.json \
  --api-url $MATRIC_API_URL \
  --api-key $MATRIC_API_KEY \
  --retry-failed \
  --log migration_log_20260131.json
```

**Problem**: Embeddings missing after import

**Solution**:
Embeddings are regenerated automatically by matric-memory. Wait 5-10 minutes and verify:

```bash
# Check embedding status
curl -H "Authorization: Bearer $MATRIC_API_KEY" \
  $MATRIC_API_URL/notes?missing_embeddings=true | jq '.notes | length'

# Trigger manual re-embedding (if needed)
curl -X POST -H "Authorization: Bearer $MATRIC_API_KEY" \
  $MATRIC_API_URL/admin/reindex_embeddings
```

### Verification Issues

**Problem**: Verification report shows content mismatches

**Solution**:
```bash
# Compare specific note content
curl http://localhost:53211/api/v1/notes/{note-id} > desktop_note.json
curl -H "Authorization: Bearer $MATRIC_API_KEY" \
  $MATRIC_API_URL/notes/{note-id} > matric_note.json

# Diff the content
diff <(jq -r '.original_content' desktop_note.json) \
     <(jq -r '.content' matric_note.json)

# If whitespace differences only, safe to ignore
# If content differs, re-import specific note
```

**Problem**: Links not working in web SPA

**Solution**:
Internal links may need UUID updates if note IDs changed during import. Use the link repair tool:

```bash
hotm-migrate repair-links \
  --api-url $MATRIC_API_URL \
  --api-key $MATRIC_API_KEY \
  --mapping migration_log_20260131.json
```

## Support and Resources

### Documentation

- **matric-memory API Docs**: [To be added - API documentation URL]
- **HotM SPA User Guide**: [To be added - web SPA user guide URL]
- **Migration Tools Repo**: [To be added - migration tools GitHub URL]

### Contact

- **Issues**: File GitHub issues at https://github.com/jmagly/hotm/issues with `[migration]` tag
- **Questions**: Discuss in GitHub Discussions under "Migration Support" category
- **Emergency**: Contact development team via [contact method TBD]

### FAQ

**Q: Will my desktop app stop working after the cutover date?**

A: No. The desktop app will continue to function with your local database. However, it will not receive updates or new features. You can use it read-only or continue editing locally (changes won't sync to web).

**Q: Can I migrate only some notes and keep others local?**

A: Yes. Use selective export (specify note IDs or date ranges). The migration tool supports partial exports.

**Q: What happens to my AI-enhanced revisions?**

A: Revised content is preserved in matric-memory as metadata. The web SPA displays revised content by default, with option to view original.

**Q: Will I lose my note history/provenance?**

A: No. Full provenance history is migrated as metadata. The web SPA may have a different UI for viewing history, but all revision data is preserved.

**Q: Can I migrate back from web to desktop later?**

A: Yes, but it requires a reverse export process. Contact support for assistance if needed.

**Q: Do I need to keep Ollama running on my machine?**

A: No. After migration, all NLP processing happens server-side via matric-memory's Ollama instance. You can uninstall local Ollama if you no longer use the desktop app.

**Q: What about offline access?**

A: The web SPA requires network connectivity. For offline scenarios, the desktop app remains available (frozen at migration snapshot). Full offline support for the SPA is planned for a future release using service workers and local caching.

---

**Document Version**: 1.0
**Author**: HotM Development Team
**Review Status**: Approved by Technical Writer
**Next Review**: After pilot migration completion or 2026-Q2
