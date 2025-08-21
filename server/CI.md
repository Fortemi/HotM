CI notes

- Tests require Postgres with `vector` extension and a database URL in `TEST_DATABASE_URL`.
- Before running tests, apply migrations from `server/migrations`.
- Example GitHub Actions service:

```yaml
services:
  postgres:
    image: ankane/pgvector:latest
    env:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: hotm_test
    ports: ["5432:5432"]
    options: >-
      --health-cmd "pg_isready -U postgres" \
      --health-interval 10s \
      --health-timeout 5s \
      --health-retries 5

steps:
  - uses: actions/checkout@v4
  - uses: dtolnay/rust-toolchain@stable
  - run: cargo fetch
  - run: |
      export TEST_DATABASE_URL=postgres://postgres:postgres@localhost:5432/hotm_test
      psql "$TEST_DATABASE_URL" -c 'CREATE EXTENSION IF NOT EXISTS vector;'
      cargo test -p hotm-server -- --nocapture
```
