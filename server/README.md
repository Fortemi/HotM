HotM Server (Rust/Axum)

Run
- Ensure PostgreSQL/DocumentDB is running and you have a database URL.
- Enable extensions once per DB: `CREATE EXTENSION IF NOT EXISTS vector;` and optionally `pg_trgm`.
- Apply migrations automatically via `sqlx::migrate!` on startup, or run `server/migrations/0001_init.sql` manually.

```bash
cd server
export DATABASE_URL=postgres://user:pass@localhost:5432/hotm
cargo run
```

API
- Base: http://127.0.0.1:53211/api/v1
- See `docs/openapi.json`

Tests
- Unit tests run with `cargo test`.
- Integration tests require `TEST_DATABASE_URL` env var. They will migrate and clean automatically.
