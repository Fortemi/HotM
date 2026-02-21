# Vision

HotM is your local-first notes, interaction, and analysis hub. The system makes NLP central while preserving the original, user-authored content for record keeping.

Principles
- Original content is immutable and always accessible
- Revised view is the default: concise, linked, and navigable
- All data is stored with UTC timestamps, displayed in system local time
- NLP is local-only via Ollama; no external calls
- Fast, indexed, hybrid search across content and metadata (PostgreSQL FTS + pgvector)
- Interactions map to deterministic MCP tools for auditability

What you get
- Quick capture with dedicated capture view and keyboard shortcuts
- Automatic revision, summarization, tagging, linking
- Provenance view showing how revisions were produced
- Powerful command palette for analytics, review, and editing

Out of scope (v1)
- Cloud sync and multi-user auth
- Third-party hosted LLMs
