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
        "66a8e5c6-d5f8-4b3d-a197-2e7ff207fcc7", // Test note 1
        "d87defa1-6a9f-4470-bb63-67934faefc87", // Test note 2
        "dfacb53a-c19f-48dd-a8bb-3ad2d92464a8", // Meeting notes
        "4b355a10-ed6f-4500-8bf5-e38978ae74f8", // UI test note
        "d2c50c5c-2317-446b-a17e-97f412791560", // Quick Sort AI-enhanced
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
  
  // Get recent notes (using search with empty query)
  async getRecentNotes(_limit: number = 20): Promise<NoteFull[]> {
    try {
      const noteIds = await this.getAllNoteIds();
      const notes: NoteFull[] = [];
      
      for (const id of noteIds) {
        try {
          const note = await this.getNote(id);
          notes.push(note);
        } catch (e) {
          console.error(`Failed to load note ${id}:`, e);
        }
      }
      
      return notes;
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