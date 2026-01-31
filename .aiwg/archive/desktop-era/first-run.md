# First-run checklist

1) Database (Microsoft DocumentDB / PostgreSQL)
- Create a database and user
- Enable extension: `CREATE EXTENSION IF NOT EXISTS vector;`
- Apply schema: `./data-model-pg.sql` (server runs migrations automatically)
- Set `DATABASE_URL` for the server (and `TEST_DATABASE_URL` for tests)

2) Ollama (local)
- Install Ollama and start the service
- Pull models:
  - `ollama pull gpt-oss:20b`
  - `ollama pull nomic-embed-text`

3) Server
- `cd server && export DATABASE_URL=... && cargo run`

4) UI
- `cd ui && npm install && npm run dev` (dev) or `npm run build` (MSI)

5) Health
- Open `http://127.0.0.1:53211/api/v1/health` → expect `{ ok:true, ollama:true, db:true, vector:true }`

Notes
- The server computes embeddings on note create/update; if Ollama is not running, it continues without vectors (semantic search degraded).
