/**
 * SKOS Concepts API client
 * Handles controlled vocabularies, taxonomies, and semantic tagging
 */

import type { ApiClient } from './client';
import { getTauriFetch } from '@/lib/tauri';
import type {
  ConceptScheme,
  CreateConceptSchemeRequest,
  Concept,
  CreateConceptRequest,
  ConceptFull,
  SkosCollection,
  CreateSkosCollectionRequest,
  SkosCollectionWithMembers,
  SetCollectionMembersRequest,
  ConceptGovernanceStats,
  ConceptListResponse,
  ConceptAutocompleteResponse,
} from './types-extended';

function normalizeConcept(raw: unknown): Concept | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const data = raw as Record<string, unknown>;
  const id =
    (typeof data.id === 'string' ? data.id : null) ??
    (typeof data.concept_id === 'string' ? data.concept_id : null) ??
    '';
  if (!id) {
    return null;
  }

  const labels = Array.isArray(data.labels)
    ? (data.labels as Array<Record<string, unknown>>)
    : [];
  const prefLabelFromLabels = labels.find((entry) => entry.label_type === 'pref_label');
  const prefLabel =
    (typeof data.pref_label === 'string' ? data.pref_label : null) ??
    (typeof prefLabelFromLabels?.value === 'string'
      ? prefLabelFromLabels.value
      : null) ??
    (typeof data.notation === 'string' ? data.notation : null) ??
    'Untitled Concept';

  const altLabelsFromLabels = labels
    .filter((entry) => entry.label_type === 'alt_label')
    .map((entry) => (typeof entry.value === 'string' ? entry.value : ''))
    .filter(Boolean);
  const altLabels = Array.isArray(data.alt_labels)
    ? (data.alt_labels as string[])
    : altLabelsFromLabels.length > 0
      ? altLabelsFromLabels
      : undefined;

  const definitionFromField =
    typeof data.definition === 'string' ? data.definition : undefined;
  const notes = Array.isArray(data.notes) ? (data.notes as Array<Record<string, unknown>>) : [];
  const definitionFromNotes = notes.find((entry) => entry.note_type === 'definition');
  const definition =
    definitionFromField ??
    (typeof definitionFromNotes?.value === 'string'
      ? definitionFromNotes.value
      : undefined);

  return {
    id,
    concept_id:
      (typeof data.concept_id === 'string' ? data.concept_id : null) ??
      id,
    scheme_id:
      (typeof data.scheme_id === 'string' ? data.scheme_id : null) ??
      (typeof data.primary_scheme_id === 'string' ? data.primary_scheme_id : null) ??
      '',
    pref_label: prefLabel,
    alt_labels: altLabels,
    definition,
    notation: typeof data.notation === 'string' ? data.notation : undefined,
    confidence: typeof data.confidence === 'number' ? data.confidence : undefined,
    relevance_score:
      typeof data.relevance_score === 'number' ? data.relevance_score : undefined,
    is_primary: typeof data.is_primary === 'boolean' ? data.is_primary : undefined,
    source: typeof data.source === 'string' ? data.source : undefined,
    created_at: typeof data.created_at === 'string' ? data.created_at : '',
    updated_at: typeof data.updated_at === 'string' ? data.updated_at : '',
  };
}

function normalizeConceptListResponse(payload: unknown): Concept[] {
  const rawList = Array.isArray(payload)
    ? payload
    : ((payload as { concepts?: unknown[] } | null)?.concepts ?? []);

  if (!Array.isArray(rawList)) {
    return [];
  }

  const seen = new Set<string>();
  const normalized: Concept[] = [];

  for (const item of rawList) {
    const concept = normalizeConcept(item);
    if (!concept) {
      continue;
    }
    if (seen.has(concept.id)) {
      continue;
    }
    seen.add(concept.id);
    normalized.push(concept);
  }

  return normalized;
}

function normalizeConceptScheme(raw: unknown): ConceptScheme | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const data = raw as Record<string, unknown>;
  const id = typeof data.id === 'string' ? data.id : '';
  const title = typeof data.title === 'string' ? data.title : '';
  if (!id || !title) {
    return null;
  }

  return {
    id,
    title,
    description: typeof data.description === 'string' ? data.description : undefined,
    namespace: typeof data.namespace === 'string' ? data.namespace : undefined,
    created_at: typeof data.created_at === 'string' ? data.created_at : '',
    updated_at: typeof data.updated_at === 'string' ? data.updated_at : '',
  };
}

function normalizeSchemeListResponse(payload: unknown): ConceptScheme[] {
  const rawList = Array.isArray(payload)
    ? payload
    : ((payload as { schemes?: unknown[] } | null)?.schemes ?? []);

  if (!Array.isArray(rawList)) {
    return [];
  }

  return rawList
    .map((item) => normalizeConceptScheme(item))
    .filter((item): item is ConceptScheme => item !== null);
}

function normalizeConceptFull(raw: unknown): ConceptFull {
  const concept = normalizeConcept(raw) ?? {
    id: '',
    scheme_id: '',
    pref_label: 'Untitled Concept',
    created_at: '',
    updated_at: '',
  };
  const data = (raw ?? {}) as Record<string, unknown>;

  return {
    ...concept,
    broader: normalizeConceptListResponse(data.broader),
    narrower: normalizeConceptListResponse(data.narrower),
    related: normalizeConceptListResponse(data.related),
    usage_count:
      (typeof data.usage_count === 'number' ? data.usage_count : null) ??
      (typeof data.note_count === 'number' ? data.note_count : undefined),
  };
}

export function createConceptsApi(client: ApiClient) {
  return {
    // ===========================
    // Concept Schemes
    // ===========================

    /**
     * List all concept schemes
     */
    async listSchemes(): Promise<ConceptScheme[]> {
      const response = await client.get<{ schemes: ConceptScheme[] } | ConceptScheme[]>(
        '/concepts/schemes'
      );
      return normalizeSchemeListResponse(response);
    },

    /**
     * Create a new concept scheme
     */
    async createScheme(
      request: CreateConceptSchemeRequest
    ): Promise<ConceptScheme> {
      if (!request.title || request.title.trim() === '') {
        throw new Error('Scheme title is required');
      }

      return client.post<ConceptScheme>('/concepts/schemes', request);
    },

    /**
     * Get a specific concept scheme
     */
    async getScheme(schemeId: string): Promise<ConceptScheme> {
      if (!schemeId || schemeId.trim() === '') {
        throw new Error('Scheme ID is required');
      }

      return client.get<ConceptScheme>(`/concepts/schemes/${schemeId}`);
    },

    /**
     * Update a concept scheme
     */
    async updateScheme(
      schemeId: string,
      updates: Partial<CreateConceptSchemeRequest>
    ): Promise<ConceptScheme> {
      if (!schemeId || schemeId.trim() === '') {
        throw new Error('Scheme ID is required');
      }

      return client.patch<ConceptScheme>(
        `/concepts/schemes/${schemeId}`,
        updates
      );
    },

    /**
     * Get top-level concepts in a scheme
     */
    async getTopConcepts(schemeId: string): Promise<Concept[]> {
      if (!schemeId || schemeId.trim() === '') {
        throw new Error('Scheme ID is required');
      }

      const response = await client.get<ConceptListResponse>(
        `/concepts/schemes/${schemeId}/top-concepts`
      );

      return normalizeConceptListResponse(response);
    },

    // ===========================
    // Concepts
    // ===========================

    /**
     * List/search concepts
     */
    async listConcepts(options: {
      schemeId?: string;
      search?: string;
      limit?: number;
    } = {}): Promise<Concept[]> {
      const params: Record<string, string> = {};

      if (options.schemeId) {
        params.scheme_id = options.schemeId;
      }

      if (options.search) {
        params.search = options.search;
      }

      if (options.limit) {
        params.limit = String(options.limit);
      }

      const response = await client.get<ConceptListResponse>(
        '/concepts',
        params
      );

      return normalizeConceptListResponse(response);
    },

    /**
     * Autocomplete concepts for type-ahead
     */
    async autocompleteConcepts(
      query: string,
      schemeId?: string
    ): Promise<ConceptAutocompleteResponse> {
      if (!query || query.trim() === '') {
        throw new Error('Query is required');
      }

      const params: Record<string, string> = { q: query };

      if (schemeId) {
        params.scheme_id = schemeId;
      }

      return client.get<ConceptAutocompleteResponse>(
        '/concepts/autocomplete',
        params
      );
    },

    /**
     * Create a new concept
     */
    async createConcept(request: CreateConceptRequest): Promise<Concept> {
      if (!request.scheme_id || request.scheme_id.trim() === '') {
        throw new Error('Scheme ID is required');
      }

      if (!request.pref_label || request.pref_label.trim() === '') {
        throw new Error('Preferred label is required');
      }

      return client.post<Concept>('/concepts', request);
    },

    /**
     * Get a specific concept (basic info)
     */
    async getConcept(conceptId: string): Promise<Concept> {
      if (!conceptId || conceptId.trim() === '') {
        throw new Error('Concept ID is required');
      }

      const response = await client.get<Concept>(`/concepts/${conceptId}`);
      const normalized = normalizeConcept(response);
      if (!normalized) {
        throw new Error('Invalid concept payload');
      }
      return normalized;
    },

    /**
     * Get full concept with relationships
     */
    async getConceptFull(conceptId: string): Promise<ConceptFull> {
      if (!conceptId || conceptId.trim() === '') {
        throw new Error('Concept ID is required');
      }

      const response = await client.get<ConceptFull>(`/concepts/${conceptId}/full`);
      return normalizeConceptFull(response);
    },

    /**
     * Update a concept
     */
    async updateConcept(
      conceptId: string,
      updates: Partial<CreateConceptRequest>
    ): Promise<Concept> {
      if (!conceptId || conceptId.trim() === '') {
        throw new Error('Concept ID is required');
      }

      return client.patch<Concept>(`/concepts/${conceptId}`, updates);
    },

    /**
     * Delete a concept
     * Fails if concept is in use by notes
     */
    async deleteConcept(conceptId: string): Promise<void> {
      if (!conceptId || conceptId.trim() === '') {
        throw new Error('Concept ID is required');
      }

      await client.delete(`/concepts/${conceptId}`);
    },

    // ===========================
    // Concept Relationships
    // ===========================

    /**
     * Get all ancestor concepts (recursive)
     */
    async getAncestors(conceptId: string): Promise<Concept[]> {
      if (!conceptId || conceptId.trim() === '') {
        throw new Error('Concept ID is required');
      }

      const response = await client.get<ConceptListResponse>(
        `/concepts/${conceptId}/ancestors`
      );

      return normalizeConceptListResponse(response);
    },

    /**
     * Get all descendant concepts (recursive)
     */
    async getDescendants(
      conceptId: string,
      depth?: number
    ): Promise<Concept[]> {
      if (!conceptId || conceptId.trim() === '') {
        throw new Error('Concept ID is required');
      }

      const params: Record<string, string> = {};
      if (depth !== undefined) {
        params.depth = String(depth);
      }

      const response = await client.get<ConceptListResponse>(
        `/concepts/${conceptId}/descendants`,
        params
      );

      return normalizeConceptListResponse(response);
    },

    /**
     * Get broader concepts (immediate parents)
     */
    async getBroader(conceptId: string): Promise<Concept[]> {
      if (!conceptId || conceptId.trim() === '') {
        throw new Error('Concept ID is required');
      }

      const response = await client.get<ConceptListResponse>(
        `/concepts/${conceptId}/broader`
      );

      return normalizeConceptListResponse(response);
    },

    /**
     * Add broader concept relationship
     */
    async addBroader(conceptId: string, broaderId: string): Promise<void> {
      if (!conceptId || conceptId.trim() === '') {
        throw new Error('Concept ID is required');
      }

      if (!broaderId || broaderId.trim() === '') {
        throw new Error('Broader concept ID is required');
      }

      await client.post(`/concepts/${conceptId}/broader`, {
        broader_id: broaderId,
      });
    },

    /**
     * Remove broader concept relationship
     */
    async removeBroader(conceptId: string, broaderId: string): Promise<void> {
      if (!conceptId || conceptId.trim() === '') {
        throw new Error('Concept ID is required');
      }

      if (!broaderId || broaderId.trim() === '') {
        throw new Error('Broader concept ID is required');
      }

      await client.delete(`/concepts/${conceptId}/broader/${broaderId}`);
    },

    /**
     * Get narrower concepts (immediate children)
     */
    async getNarrower(conceptId: string): Promise<Concept[]> {
      if (!conceptId || conceptId.trim() === '') {
        throw new Error('Concept ID is required');
      }

      const response = await client.get<ConceptListResponse>(
        `/concepts/${conceptId}/narrower`
      );

      return normalizeConceptListResponse(response);
    },

    /**
     * Add narrower concept relationship
     */
    async addNarrower(conceptId: string, narrowerId: string): Promise<void> {
      if (!conceptId || conceptId.trim() === '') {
        throw new Error('Concept ID is required');
      }

      if (!narrowerId || narrowerId.trim() === '') {
        throw new Error('Narrower concept ID is required');
      }

      await client.post(`/concepts/${conceptId}/narrower`, {
        narrower_id: narrowerId,
      });
    },

    /**
     * Remove narrower concept relationship
     */
    async removeNarrower(
      conceptId: string,
      narrowerId: string
    ): Promise<void> {
      if (!conceptId || conceptId.trim() === '') {
        throw new Error('Concept ID is required');
      }

      if (!narrowerId || narrowerId.trim() === '') {
        throw new Error('Narrower concept ID is required');
      }

      await client.delete(
        `/concepts/${conceptId}/narrower/${narrowerId}`
      );
    },

    /**
     * Get related concepts (associative, not hierarchical)
     */
    async getRelated(conceptId: string): Promise<Concept[]> {
      if (!conceptId || conceptId.trim() === '') {
        throw new Error('Concept ID is required');
      }

      const response = await client.get<ConceptListResponse>(
        `/concepts/${conceptId}/related`
      );

      return normalizeConceptListResponse(response);
    },

    /**
     * Add related concept relationship
     */
    async addRelated(conceptId: string, relatedId: string): Promise<void> {
      if (!conceptId || conceptId.trim() === '') {
        throw new Error('Concept ID is required');
      }

      if (!relatedId || relatedId.trim() === '') {
        throw new Error('Related concept ID is required');
      }

      await client.post(`/concepts/${conceptId}/related`, {
        related_id: relatedId,
      });
    },

    /**
     * Remove related concept relationship
     */
    async removeRelated(conceptId: string, relatedId: string): Promise<void> {
      if (!conceptId || conceptId.trim() === '') {
        throw new Error('Concept ID is required');
      }

      if (!relatedId || relatedId.trim() === '') {
        throw new Error('Related concept ID is required');
      }

      await client.delete(`/concepts/${conceptId}/related/${relatedId}`);
    },

    // ===========================
    // Note Tagging with Concepts
    // ===========================

    /**
     * Get all concepts applied to a note
     */
    async getNoteConcepts(noteId: string): Promise<Concept[]> {
      if (!noteId || noteId.trim() === '') {
        throw new Error('Note ID is required');
      }

      const response = await client.get<ConceptListResponse>(
        `/notes/${noteId}/concepts`
      );

      return normalizeConceptListResponse(response);
    },

    /**
     * Tag a note with a concept
     */
    async tagNote(noteId: string, conceptId: string): Promise<void> {
      if (!noteId || noteId.trim() === '') {
        throw new Error('Note ID is required');
      }

      if (!conceptId || conceptId.trim() === '') {
        throw new Error('Concept ID is required');
      }

      await client.post(`/notes/${noteId}/concepts`, {
        concept_id: conceptId,
      });
    },

    /**
     * Untag a note from a concept
     */
    async untagNote(noteId: string, conceptId: string): Promise<void> {
      if (!noteId || noteId.trim() === '') {
        throw new Error('Note ID is required');
      }

      if (!conceptId || conceptId.trim() === '') {
        throw new Error('Concept ID is required');
      }

      await client.delete(`/notes/${noteId}/concepts/${conceptId}`);
    },

    // ===========================
    // Governance
    // ===========================

    /**
     * Get governance statistics for concepts
     */
    async getGovernanceStats(): Promise<ConceptGovernanceStats> {
      return client.get<ConceptGovernanceStats>('/concepts/governance');
    },

    /**
     * Export concept scheme as RDF Turtle
     */
    async exportTurtle(schemeId: string): Promise<string> {
      if (!schemeId || schemeId.trim() === '') {
        throw new Error('Scheme ID is required');
      }

      // Returns text/turtle
      const baseUrl = client.baseUrl;
      const response = await getTauriFetch()(
        `${baseUrl}/concepts/schemes/${schemeId}/export/turtle`
      );

      if (!response.ok) {
        throw new Error(`Export failed: ${response.statusText}`);
      }

      return response.text();
    },

    // ===========================
    // SKOS Collections
    // ===========================

    /**
     * List SKOS collections
     */
    async listCollections(schemeId?: string): Promise<SkosCollection[]> {
      const params: Record<string, string> = {};

      if (schemeId) {
        params.scheme_id = schemeId;
      }

      const response = await client.get<{ collections: SkosCollection[] }>(
        '/concepts/collections',
        params
      );

      return Array.isArray((response as { collections?: SkosCollection[] }).collections)
        ? (response as { collections: SkosCollection[] }).collections
        : (Array.isArray(response) ? (response as SkosCollection[]) : []);
    },

    /**
     * Create a SKOS collection
     */
    async createCollection(
      request: CreateSkosCollectionRequest
    ): Promise<SkosCollection> {
      if (!request.scheme_id || request.scheme_id.trim() === '') {
        throw new Error('Scheme ID is required');
      }

      if (!request.label || request.label.trim() === '') {
        throw new Error('Collection label is required');
      }

      return client.post<SkosCollection>(
        '/concepts/collections',
        request
      );
    },

    /**
     * Get a SKOS collection with members
     */
    async getCollection(collectionId: string): Promise<SkosCollectionWithMembers> {
      if (!collectionId || collectionId.trim() === '') {
        throw new Error('Collection ID is required');
      }

      return client.get<SkosCollectionWithMembers>(
        `/concepts/collections/${collectionId}`
      );
    },

    /**
     * Update a SKOS collection
     */
    async updateCollection(
      collectionId: string,
      updates: Partial<CreateSkosCollectionRequest>
    ): Promise<SkosCollection> {
      if (!collectionId || collectionId.trim() === '') {
        throw new Error('Collection ID is required');
      }

      return client.patch<SkosCollection>(
        `/concepts/collections/${collectionId}`,
        updates
      );
    },

    /**
     * Delete a SKOS collection
     */
    async deleteCollection(collectionId: string): Promise<void> {
      if (!collectionId || collectionId.trim() === '') {
        throw new Error('Collection ID is required');
      }

      await client.delete(`/concepts/collections/${collectionId}`);
    },

    /**
     * Replace all members of a collection
     */
    async setCollectionMembers(
      collectionId: string,
      request: SetCollectionMembersRequest
    ): Promise<void> {
      if (!collectionId || collectionId.trim() === '') {
        throw new Error('Collection ID is required');
      }

      if (!request.concept_ids || request.concept_ids.length === 0) {
        throw new Error('At least one concept ID is required');
      }

      await client.put(
        `/concepts/collections/${collectionId}/members`,
        request
      );
    },

    /**
     * Add a concept to a collection
     */
    async addCollectionMember(
      collectionId: string,
      conceptId: string
    ): Promise<void> {
      if (!collectionId || collectionId.trim() === '') {
        throw new Error('Collection ID is required');
      }

      if (!conceptId || conceptId.trim() === '') {
        throw new Error('Concept ID is required');
      }

      await client.post(
        `/concepts/collections/${collectionId}/members/${conceptId}`
      );
    },

    /**
     * Remove a concept from a collection
     */
    async removeCollectionMember(
      collectionId: string,
      conceptId: string
    ): Promise<void> {
      if (!collectionId || collectionId.trim() === '') {
        throw new Error('Collection ID is required');
      }

      if (!conceptId || conceptId.trim() === '') {
        throw new Error('Concept ID is required');
      }

      await client.delete(
        `/concepts/collections/${collectionId}/members/${conceptId}`
      );
    },
  };
}

export type ConceptsApi = ReturnType<typeof createConceptsApi>;
