import { useState, useEffect } from 'react';
import './App.css';

const API_BASE = 'http://127.0.0.1:53211/api/v1';

interface Note {
  id: string;
  content: string;
  revised_content?: string;
  created_at_utc: string;
  updated_at_utc: string;
  tags?: string[];
  collection_id?: string;
}

interface SearchResult {
  note: Note;
  score: number;
  highlights?: string[];
}

function App() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [newNoteContent, setNewNoteContent] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showRevised, setShowRevised] = useState(true);
  const [serverStatus, setServerStatus] = useState<{ ok: boolean; message?: string } | null>(null);

  // Check server health on mount
  useEffect(() => {
    checkServerHealth();
    loadRecentNotes();
  }, []);

  const checkServerHealth = async () => {
    try {
      const response = await fetch(`${API_BASE}/health`);
      const data = await response.json();
      setServerStatus({ ok: data.ok });
    } catch (error) {
      setServerStatus({ ok: false, message: 'Cannot connect to HotM server' });
    }
  };

  const loadRecentNotes = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`${API_BASE}/search?limit=10`);
      if (response.ok) {
        const data = await response.json();
        setNotes(data.results.map((r: SearchResult) => r.note));
      }
    } catch (error) {
      console.error('Failed to load notes:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const createNote = async () => {
    if (!newNoteContent.trim()) return;

    try {
      setIsLoading(true);
      const response = await fetch(`${API_BASE}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newNoteContent })
      });

      if (response.ok) {
        const newNote = await response.json();
        setNotes([newNote, ...notes]);
        setNewNoteContent('');
      }
    } catch (error) {
      console.error('Failed to create note:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const searchNotes = async () => {
    if (!searchQuery.trim()) {
      loadRecentNotes();
      return;
    }

    try {
      setIsLoading(true);
      const response = await fetch(`${API_BASE}/search?q=${encodeURIComponent(searchQuery)}`);
      if (response.ok) {
        const data = await response.json();
        setNotes(data.results.map((r: SearchResult) => r.note));
      }
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const viewNote = async (id: string) => {
    try {
      const response = await fetch(`${API_BASE}/notes/${id}`);
      if (response.ok) {
        const note = await response.json();
        setSelectedNote(note);
      }
    } catch (error) {
      console.error('Failed to load note:', error);
    }
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>HotM - Notes & Analysis</h1>
        <div className="server-status">
          {serverStatus?.ok ? (
            <span className="status-ok">✓ Connected</span>
          ) : (
            <span className="status-error">✗ {serverStatus?.message || 'Disconnected'}</span>
          )}
        </div>
      </header>

      <div className="app-body">
        <aside className="sidebar">
          <div className="note-create">
            <textarea
              value={newNoteContent}
              onChange={(e) => setNewNoteContent(e.target.value)}
              placeholder="Write a new note..."
              rows={4}
            />
            <button onClick={createNote} disabled={isLoading || !serverStatus?.ok}>
              Create Note
            </button>
          </div>

          <div className="search-box">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && searchNotes()}
              placeholder="Search notes..."
            />
            <button onClick={searchNotes} disabled={isLoading || !serverStatus?.ok}>
              Search
            </button>
          </div>

          <div className="notes-list">
            {isLoading ? (
              <div className="loading">Loading...</div>
            ) : (
              notes.map(note => (
                <div
                  key={note.id}
                  className={`note-item ${selectedNote?.id === note.id ? 'selected' : ''}`}
                  onClick={() => viewNote(note.id)}
                >
                  <div className="note-preview">
                    {(showRevised && note.revised_content ? note.revised_content : note.content).substring(0, 100)}...
                  </div>
                  <div className="note-meta">
                    {new Date(note.created_at_utc).toLocaleDateString()}
                  </div>
                </div>
              ))
            )}
          </div>
        </aside>

        <main className="content">
          {selectedNote ? (
            <div className="note-detail">
              <div className="note-header">
                <h2>Note Details</h2>
                <label className="toggle">
                  <input
                    type="checkbox"
                    checked={showRevised}
                    onChange={(e) => setShowRevised(e.target.checked)}
                  />
                  Show Revised
                </label>
              </div>
              <div className="note-content">
                {showRevised && selectedNote.revised_content
                  ? selectedNote.revised_content
                  : selectedNote.content}
              </div>
              <div className="note-metadata">
                <div>Created: {new Date(selectedNote.created_at_utc).toLocaleString()}</div>
                <div>Updated: {new Date(selectedNote.updated_at_utc).toLocaleString()}</div>
                {selectedNote.tags && selectedNote.tags.length > 0 && (
                  <div>Tags: {selectedNote.tags.join(', ')}</div>
                )}
              </div>
            </div>
          ) : (
            <div className="empty-state">
              <p>Select a note to view details</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export default App;