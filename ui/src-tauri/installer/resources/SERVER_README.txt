Hall of the Mind Server - Configuration Guide
=============================================

The HotM Server provides a local HTTP API on port 53211 for integrations and automation.

IMPORTANT: Server requires PostgreSQL database setup before use.

Quick Start:
1. Install PostgreSQL with pgvector extension
2. Create database: CREATE DATABASE hotm_dev;
3. Enable extension: CREATE EXTENSION IF NOT EXISTS vector;
4. Set environment variable: DATABASE_URL=postgres://user:pass@localhost:5432/hotm_dev

The server is installed as a Windows Service:
- Service Name: HotmServer
- Display Name: Hall of the Mind Server
- Auto-start: Yes

Configuration:
- Port: 53211 (configurable via environment)
- Database: PostgreSQL with pgvector
- API Documentation: See docs/02-specifications/api-specification.md

For detailed setup instructions, visit:
https://github.com/jmagly/hotm/blob/main/CLAUDE.md

Service Management:
- Start: sc start HotmServer
- Stop: sc stop HotmServer  
- Status: sc query HotmServer

Logs are available in Windows Event Viewer under "Hall of the Mind Server".