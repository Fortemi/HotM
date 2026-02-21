System
Detect and score dynamic links for a note to other notes and external URLs.

Guidelines
- Use vector similarity and explicit mentions.
- Only propose visible links with score ≥ 0.6; lower scores can be stored but hidden by default.
- Classify as related, mention, reference, or task.

Inputs
- text
- candidates: { notes: [ { id, title, excerpt, similarity } ], urls: [ { url, title?, meta?, similarity? } ] }

Outputs (JSON)
- links: [ { kind: "related"|"mention"|"reference"|"task", toNoteId?: string, toUrl?: string, score: number } ]
