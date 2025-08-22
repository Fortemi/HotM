// API Service for Hall of the Mind

// Use localhost which works from both WSL and Windows
const API_BASE = 'http://localhost:53211/api/v1';

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

export interface RelatedNotesResponse {
  related: SearchHit[];
  context_summary?: string;
}

export interface NoteSummary {
  id: string;
  title: string;
  snippet: string;
  created_at_utc: string;
  updated_at_utc: string;
  starred: boolean;
  archived: boolean;
  tags: string[];
  has_revision: boolean;
  metadata: any;
}

export interface ListNotesResponse {
  notes: NoteSummary[];
  total: number;
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

  // Search notes
  async searchNotes(query: string, mode: "fts" | "semantic" | "hybrid" = "hybrid", filters?: string): Promise<any[]> {
    const params = new URLSearchParams({ q: query, mode });
    if (filters) {
      params.append('filters', filters);
    }
    const response = await this.request<{ notes: any[] }>(`/search?${params}`);
    return response.notes || [];
  }

  // Health check with retry logic
  async checkHealth(): Promise<HealthResponse> {
    try {
      return await this.request<HealthResponse>('/health');
    } catch (error) {
      console.log('Trying alternative API endpoints...');
      // Try different endpoints in case of connection issues
      const alternativeEndpoints = [
        'http://127.0.0.1:53211/api/v1',
        'http://0.0.0.0:53211/api/v1',
      ];
      
      for (const endpoint of alternativeEndpoints) {
        try {
          const response = await fetch(`${endpoint}/health`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
          });
          if (response.ok) {
            console.log(`Connected via ${endpoint}`);
            return await response.json();
          }
        } catch (e) {
          console.log(`Failed to connect to ${endpoint}`);
        }
      }
      throw error;
    }
  }

  // Create a new note
  async createNote(content: string): Promise<CreateNoteResponse> {
    const response = await this.request<CreateNoteResponse>('/notes', {
      method: 'POST',
      body: JSON.stringify({ content }),
    });
    
    // Store the new note ID
    const storedIds = JSON.parse(localStorage.getItem('hotm_note_ids') || '[]');
    if (!storedIds.includes(response.note_id)) {
      storedIds.push(response.note_id);
      localStorage.setItem('hotm_note_ids', JSON.stringify(storedIds));
    }
    
    return response;
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

  // Trigger AI regeneration for a note
  async regenerateAI(id: string): Promise<any> {
    return this.request(`/notes/${id}/regenerate-ai`, {
      method: 'POST',
    });
  }

  // Search notes
  async searchNotes(query: string, mode: 'hybrid' | 'fts' | 'vector' = 'fts'): Promise<SearchResponse> {
    const params = new URLSearchParams({ q: query, mode });
    return this.request<SearchResponse>(`/search?${params}`);
  }

  // Get all notes IDs (we'll fetch them individually for now)
  async getAllNoteIds(): Promise<string[]> {
    try {
      // Get stored note IDs from localStorage
      const storedIds = JSON.parse(localStorage.getItem('hotm_note_ids') || '[]');
      
      // Known test notes
      const knownIds = [
        "c4fa9d62-ee86-42fe-85c8-52f2d4301450", // Rich markdown test note
        "59dc8ac5-893b-4552-8234-48891a74a7d0", // Empty test note
        "1f8aab7b-7add-4144-b44f-534f2f096bf1", // API test note
      ];
      
      // Combine and deduplicate
      const allIds = [...new Set([...storedIds, ...knownIds])];
      
      const validIds: string[] = [];
      for (const id of allIds) {
        try {
          await this.getNote(id);
          validIds.push(id);
        } catch (e) {
          // Note doesn't exist anymore
        }
      }
      
      // Update localStorage with valid IDs
      localStorage.setItem('hotm_note_ids', JSON.stringify(validIds));
      
      return validIds;
    } catch (error) {
      console.error('Failed to get note IDs:', error);
      return [];
    }
  }
  
  // Get notes with sorting and filtering
  async getNotes(
    sortBy: 'created_at' | 'updated_at' | 'accessed_at' = 'created_at',
    filter: 'all' | 'starred' | 'archived' | 'recent' = 'all',
    limit: number = 50
  ): Promise<NoteSummary[]> {
    const params = new URLSearchParams({
      sort_by: sortBy,
      sort_order: 'desc',
      filter,
      limit: limit.toString(),
    });
    
    const response = await this.request<ListNotesResponse>(`/notes?${params}`);
    return response.notes;
  }
  
  // Get recent notes (using new list endpoint)
  async getRecentNotes(limit: number = 20): Promise<NoteFull[]> {
    try {
      // Get note summaries first
      const summaries = await this.getNotes('created_at', 'all', limit);
      
      // Fetch full notes for each summary
      const notes: NoteFull[] = [];
      for (const summary of summaries) {
        try {
          const note = await this.getNote(summary.id);
          notes.push(note);
        } catch (e) {
          console.error(`Failed to load note ${summary.id}:`, e);
        }
      }
      
      return notes;
    } catch (error) {
      console.error('Failed to get recent notes:', error);
      return [];
    }
  }
  
  // Update note status (star/archive)
  async updateNoteStatus(id: string, starred?: boolean, archived?: boolean): Promise<any> {
    return this.request(`/notes/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ starred, archived }),
    });
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

  // Get related notes for a specific note
  async getRelatedNotes(id: string): Promise<RelatedNotesResponse> {
    return this.request<RelatedNotesResponse>(`/notes/${id}/related`);
  }
}

export const api = new ApiClient();