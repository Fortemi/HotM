// API Service for Hall of the Mind

const API_BASE = 'http://127.0.0.1:53211/api/v1';

// Backend API types
interface NoteMeta {
  id: string;
  collection_id?: string;
  format: string;
  source: string;
  created_at_utc: string;
  updated_at_utc: string;
}

interface NoteOriginal {
  content: string;
  hash: string;
}

interface NoteRevised {
  content: string;
  last_revision_id?: string;
}

interface Link {
  id: string;
  from_note_id: string;
  to_note_id?: string;
  to_url?: string;
  kind: string;
  score: number;
  created_at_utc: string;
}

export interface NoteFull {
  note: NoteMeta;
  original: NoteOriginal;
  revised: NoteRevised;
  tags: string[];
  links: Link[];
}

export interface CreateNoteRequest {
  content: string;
  format?: string;
  source?: string;
}

export interface CreateNoteResponse {
  note_id: string;
}

export interface SearchHit {
  note_id: string;
  score: number;
  snippet?: string;
}

export interface SearchResponse {
  hits: SearchHit[];
}

export interface HealthResponse {
  ok: boolean;
  ollama: boolean;
  db: boolean;
  vector: boolean;
}

// API Client
class ApiClient {
  private async request<T>(
    path: string,
    options: RequestInit = {}
  ): Promise<T> {
    try {
      const response = await fetch(`${API_BASE}${path}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });

      if (!response.ok) {
        throw new Error(`API Error: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('API Request failed:', error);
      throw error;
    }
  }

  // Health check
  async checkHealth(): Promise<HealthResponse> {
    return this.request<HealthResponse>('/health');
  }

  // Create a new note
  async createNote(content: string): Promise<CreateNoteResponse> {
    return this.request<CreateNoteResponse>('/notes', {
      method: 'POST',
      body: JSON.stringify({ content }),
    });
  }

  // Get a specific note
  async getNote(id: string): Promise<NoteFull> {
    return this.request<NoteFull>(`/notes/${id}`);
  }

  // Update note revision
  async updateRevision(id: string, content: string, rationale?: string): Promise<any> {
    return this.request(`/notes/${id}/revised`, {
      method: 'PUT',
      body: JSON.stringify({ content, rationale }),
    });
  }

  // Search notes
  async searchNotes(query: string, mode: 'hybrid' | 'fts' | 'vector' = 'fts'): Promise<SearchResponse> {
    const params = new URLSearchParams({ q: query, mode });
    return this.request<SearchResponse>(`/search?${params}`);
  }

  // Get recent notes (using search with empty query)
  async getRecentNotes(_limit: number = 20): Promise<NoteFull[]> {
    try {
      // For now, we'll create a default note list since search needs fixing
      // TODO: Fix search endpoint to support empty queries
      return [];
    } catch (error) {
      console.error('Failed to get recent notes:', error);
      return [];
    }
  }

  // Add tags to a note
  async updateNoteTags(id: string, add?: string[], remove?: string[]): Promise<{ tags: string[] }> {
    return this.request(`/notes/${id}/tags`, {
      method: 'PUT',
      body: JSON.stringify({ add, remove }),
    });
  }

  // Create a tag
  async createTag(name: string): Promise<{ name: string }> {
    return this.request('/tags', {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
  }
}

export const api = new ApiClient();