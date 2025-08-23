Hall of the Mind Server - Network Hub Configuration
==================================================

The HotM Server provides centralized knowledge processing for home and small office networks.
Designed for security-minded users who want local-first deployments with inference power.

NETWORK DEPLOYMENT SCENARIOS:
- Home Network Hub: Central server with GPU/AI acceleration, multiple client workstations
- Small Office Setup: Dedicated server machine, distributed client access
- Developer Environment: Local server for API development and integrations

IMPORTANT: Server requires PostgreSQL database and Ollama setup before use.

Quick Setup:
1. Install PostgreSQL with pgvector extension
2. Create database: CREATE DATABASE hotm_dev;
3. Enable extension: CREATE EXTENSION IF NOT EXISTS vector;
4. Set environment variable: DATABASE_URL=postgres://user:pass@localhost:5432/hotm_dev
5. Install Ollama with models: gpt-oss:20b, nomic-embed-text

Network Configuration:
- Server listens on: http://0.0.0.0:53211
- Client connections: Point desktop clients to this server IP
- Firewall: Open port 53211 for network access
- Security: Network runs locally, no external data transmission

Windows Service Details:
- Service Name: HotmServer
- Display Name: Hall of the Mind Server
- Auto-start: Yes (starts with Windows)

Service Management:
- Start: sc start HotmServer
- Stop: sc stop HotmServer  
- Status: sc query HotmServer
- Logs: Windows Event Viewer > "Hall of the Mind Server"

For complete setup instructions and network deployment guide:
https://github.com/jmagly/hotm/blob/main/CLAUDE.md