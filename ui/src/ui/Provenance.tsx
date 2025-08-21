import React, { useEffect, useState } from 'react'

const API_BASE = 'http://127.0.0.1:53211/api/v1'

type Revision = { id: string, parent_revision_id?: string|null, created_at_utc: string }

type Edge = { id: string, revision_id: string, source_note_id?: string|null, source_url?: string|null, relation: string, created_at_utc: string }

type Prov = { revisions: Revision[], edges: Edge[] }

export default function Provenance({ id }: { id: string }) {
  const [prov, setProv] = useState<Prov | null>(null)
  useEffect(() => { (async () => {
    const res = await fetch(`${API_BASE}/notes/${id}/provenance`)
    const data = await res.json()
    setProv(data)
  })() }, [id])

  if (!prov) return <div>Loading…</div>
  return (
    <div>
      <div style={{ marginBottom: 8 }}>Revisions: {prov.revisions.length}</div>
      <ul>
        {prov.revisions.map(r => (
          <li key={r.id}>{r.id.slice(0,8)} {r.parent_revision_id ? `<= ${r.parent_revision_id.slice(0,8)}` : ''} @ {new Date(r.created_at_utc).toLocaleString()}</li>
        ))}
      </ul>
      <div style={{ marginTop: 12 }}>Edges</div>
      <ul>
        {prov.edges.map(e => (
          <li key={e.id}>{e.relation} -> {e.source_note_id ? e.source_note_id.slice(0,8) : (e.source_url || '')}</li>
        ))}
      </ul>
    </div>
  )
}
