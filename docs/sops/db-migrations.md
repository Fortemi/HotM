# SOP: Database Migrations

## Create
```bash
cd server
sqlx migrate add -r <meaningful_name>
```
Edit the up/down SQL files in `server/migrations/`.

## Apply (local/dev)
```bash
export DATABASE_URL=postgres://user:pass@localhost:5432/hotm_dev
sqlx migrate run
```

## Tests
- Use `TEST_DATABASE_URL` and ephemeral DBs (see `server/tests/common`).
- CI can call `server/setup_ci_db.sh` to prepare `hotm_test`.

## Rollback
```bash
sqlx migrate revert
```

## Conventions
- One concern per migration; idempotent and reversible.
- Name columns/tables with `snake_case`; avoid destructive changes without backups.

