import React, { useEffect, useState } from 'react'
import Provenance from './Provenance'

type Note = {
  note: { id: string, collection_id?: string|null }
  original: { content: string }
  revised: { content: string }
  tags?: string[]
  links?: { to_note_id?: string|null, to_url?: string|null, kind: string, score: number }[]
}

type SearchHit = { note_id: string, score: number }

const API_BASE = 'http://127.0.0.1:53211/api/v1'

export default function App() {
  const [q, setQ] = useState('')
  const [hits, setHits] = useState<SearchHit[]>([])
  const [note, setNote] = useState<Note | null>(null)
  const [tab, setTab] = useState<'revised'|'original'|'prov'>('revised')
  const [content, setContent] = useState('')
  const [creating, setCreating] = useState(false)
  const [newTag, setNewTag] = useState('')
  const [collection, setCollection] = useState('')
  const [health, setHealth] = useState<{ ok: boolean, ollama: boolean } | null>(null)

  useEffect(() => { (async () => {
    try { const r = await fetch(`${API_BASE}/health`); const d = await r.json(); setHealth(d) } catch { setHealth({ ok:false, ollama:false }) }
  })() }, [])

  async function doSearch(mode?: string) {
    const params = new URLSearchParams({ q })
    if (mode) params.set('mode', mode)
    const res = await fetch(`${API_BASE}/search?${params}`)
    const data = await res.json()
    setHits(data.hits)
  }

  async function openNote(id: string) {
    const res = await fetch(`${API_BASE}/notes/${id}`)
    const data = await res.json()
    setNote(data)
  }

  async function addTag() {
    if (!note || !newTag.trim()) return
    await fetch(`${API_BASE}/tags`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: newTag.trim() }) })
    await fetch(`${API_BASE}/notes/${note.note.id}/tags`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ add: [newTag.trim()] }) })
    setNewTag('')
    await openNote(note.note.id)
  }

  async function setCollectionId() {
    if (!note || !collection.trim()) return
    await fetch(`${API_BASE}/notes/${note.note.id}/collection`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ collectionId: collection.trim() }) })
    await openNote(note.note.id)
  }

  async function createNote() {
    setCreating(true)
    const res = await fetch(`${API_BASE}/notes`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content, format: 'markdown', source: 'manual' }) })
    const data = await res.json()
    setCreating(false)
    setContent('')
    await doSearch()
    await openNote(data.noteId)
  }

  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ width: 360, borderRight: '1px solid #eee', padding: 12 }}>
        {health && (!health.ok || !health.ollama) && (
          <div style={{ background: '#fff3cd', color: '#664d03', padding: 8, border: '1px solid #ffe69c', marginBottom: 8 }}>
            Health: {health.ok ? 'OK' : 'Degraded'}; Ollama: {health.ollama ? 'OK' : 'Not running'}
          </div>
        )}
        <div>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search (tag:, collection:)" style={{ width: '100%', padding: 8 }} />
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button onClick={() => doSearch('hybrid')}>Search</button>
            <button onClick={() => doSearch('vector')}>Semantic</button>
            <button onClick={() => doSearch('fts')}>Keyword</button>
          </div>
        </div>
        <div style={{ marginTop: 16 }}>
          {hits.map(h => (
            <div key={h.note_id} style={{ padding: 8, borderBottom: '1px solid #f0f0f0', cursor: 'pointer' }} onClick={() => openNote(h.note_id)}>
              <div style={{ fontSize: 12, color: '#888' }}>{h.note_id.slice(0,8)}</div>
              <div>Score: {h.score.toFixed(3)}</div>
            </div>
          ))}
        </div>
      </div>
      <div style={{ flex: 1, padding: 16 }}>
        <h3>Quick Capture</h3>
        <textarea value={content} onChange={e => setContent(e.target.value)} rows={6} style={{ width: '100%', padding: 8 }} placeholder="Paste or type notes..." />
        <div style={{ marginTop: 8 }}>
          <button onClick={createNote} disabled={creating || !content.trim()}>Save</button>
        </div>

        {note && (
          <div style={{ marginTop: 24 }}>
            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <button onClick={() => setTab('revised')} disabled={tab==='revised'}>Revised</button>
              <button onClick={() => setTab('original')} disabled={tab==='original'}>Original</button>
              <button onClick={() => setTab('prov')} disabled={tab==='prov'}>Provenance</button>
            </div>
            {tab==='revised' && (
              <div>
                <div style={{ whiteSpace: 'pre-wrap', border: '1px solid #eee', padding: 12 }}>{note.revised.content}</div>
                {!!note?.links?.length && (
                  <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {note.links!.map((l, i) => (
                      <span key={i} style={{ border: '1px solid #ddd', padding: '2px 6px', borderRadius: 8, background: '#f7f7f7' }}>
                        {l.kind}: {l.to_url ? l.to_url : (l.to_note_id?.slice(0,8) || '')}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
            {tab==='original' && <div style={{ whiteSpace: 'pre-wrap', border: '1px solid #eee', padding: 12 }}>{note.original.content}</div>}
            {tab==='prov' && <Provenance id={note.note.id} />}
            <div style={{ marginTop: 16 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input value={newTag} onChange={e => setNewTag(e.target.value)} placeholder="Add tag" />
                <button onClick={addTag}>Add Tag</button>
              </div>
              <div style={{ marginTop: 8, display: 'flex', gap: 8, alignItems: 'center' }}>
                <input value={collection} onChange={e => setCollection(e.target.value)} placeholder="Set collection UUID" />
                <button onClick={setCollectionId}>Set Collection</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
