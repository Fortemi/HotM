/**
 * SKOS Concepts API client
 * Handles controlled vocabularies, taxonomies, and semantic tagging
 */

import type { ApiClient } from './client';
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

export function createConceptsApi(client: ApiClient) {
  return {
    // ===========================
    // Concept Schemes
    // ===========================

    /**
     * List all concept schemes
     */
    async listSchemes(): Promise<ConceptScheme[]> {
      const response = await client.get<{ schemes: ConceptScheme[] }>(
        '/api/v1/concepts/schemes'
      );
      return response.schemes;
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

      return client.post<ConceptScheme>('/api/v1/concepts/schemes', request);
    },

    /**
     * Get a specific concept scheme
     */
    async getScheme(schemeId: string): Promise<ConceptScheme> {
      if (!schemeId || schemeId.trim() === '') {
        throw new Error('Scheme ID is required');
      }

      return client.get<ConceptScheme>(`/api/v1/concepts/schemes/${schemeId}`);
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
        `/api/v1/concepts/schemes/${schemeId}`,
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
        `/api/v1/concepts/schemes/${schemeId}/top-concepts`
      );

      return response.concepts;
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
        '/api/v1/concepts',
        params
      );

      return response.concepts;
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
        '/api/v1/concepts/autocomplete',
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

      return client.post<Concept>('/api/v1/concepts', request);
    },

    /**
     * Get a specific concept (basic info)
     */
    async getConcept(conceptId: string): Promise<Concept> {
      if (!conceptId || conceptId.trim() === '') {
        throw new Error('Concept ID is required');
      }

      return client.get<Concept>(`/api/v1/concepts/${conceptId}`);
    },

    /**
     * Get full concept with relationships
     */
    async getConceptFull(conceptId: string): Promise<ConceptFull> {
      if (!conceptId || conceptId.trim() === '') {
        throw new Error('Concept ID is required');
      }

      return client.get<ConceptFull>(`/api/v1/concepts/${conceptId}/full`);
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

      return client.patch<Concept>(`/api/v1/concepts/${conceptId}`, updates);
    },

    /**
     * Delete a concept
     * Fails if concept is in use by notes
     */
    async deleteConcept(conceptId: string): Promise<void> {
      if (!conceptId || conceptId.trim() === '') {
        throw new Error('Concept ID is required');
      }

      await client.delete(`/api/v1/concepts/${conceptId}`);
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
        `/api/v1/concepts/${conceptId}/ancestors`
      );

      return response.concepts;
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
        `/api/v1/concepts/${conceptId}/descendants`,
        params
      );

      return response.concepts;
    },

    /**
     * Get broader concepts (immediate parents)
     */
    async getBroader(conceptId: string): Promise<Concept[]> {
      if (!conceptId || conceptId.trim() === '') {
        throw new Error('Concept ID is required');
      }

      const response = await client.get<ConceptListResponse>(
        `/api/v1/concepts/${conceptId}/broader`
      );

      return response.concepts;
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

      await client.post(`/api/v1/concepts/${conceptId}/broader`, {
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

      await client.delete(`/api/v1/concepts/${conceptId}/broader/${broaderId}`);
    },

    /**
     * Get narrower concepts (immediate children)
     */
    async getNarrower(conceptId: string): Promise<Concept[]> {
      if (!conceptId || conceptId.trim() === '') {
        throw new Error('Concept ID is required');
      }

      const response = await client.get<ConceptListResponse>(
        `/api/v1/concepts/${conceptId}/narrower`
      );

      return response.concepts;
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

      await client.post(`/api/v1/concepts/${conceptId}/narrower`, {
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
        `/api/v1/concepts/${conceptId}/narrower/${narrowerId}`
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
        `/api/v1/concepts/${conceptId}/related`
      );

      return response.concepts;
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

      await client.post(`/api/v1/concepts/${conceptId}/related`, {
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

      await client.delete(`/api/v1/concepts/${conceptId}/related/${relatedId}`);
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
        `/api/v1/notes/${noteId}/concepts`
      );

      return response.concepts;
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

      await client.post(`/api/v1/notes/${noteId}/concepts`, {
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

      await client.delete(`/api/v1/notes/${noteId}/concepts/${conceptId}`);
    },

    // ===========================
    // Governance
    // ===========================

    /**
     * Get governance statistics for concepts
     */
    async getGovernanceStats(): Promise<ConceptGovernanceStats> {
      return client.get<ConceptGovernanceStats>('/api/v1/concepts/governance');
    },

    /**
     * Export concept scheme as RDF Turtle
     */
    async exportTurtle(schemeId: string): Promise<string> {
      if (!schemeId || schemeId.trim() === '') {
        throw new Error('Scheme ID is required');
      }

      // Returns text/turtle
      const response = await fetch(
        `/api/v1/concepts/schemes/${schemeId}/export/turtle`
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
        '/api/v1/concepts/collections',
        params
      );

      return response.collections;
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
        '/api/v1/concepts/collections',
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
        `/api/v1/concepts/collections/${collectionId}`
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
        `/api/v1/concepts/collections/${collectionId}`,
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

      await client.delete(`/api/v1/concepts/collections/${collectionId}`);
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
        `/api/v1/concepts/collections/${collectionId}/members`,
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
        `/api/v1/concepts/collections/${collectionId}/members/${conceptId}`
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
        `/api/v1/concepts/collections/${collectionId}/members/${conceptId}`
      );
    },
  };
}

export type ConceptsApi = ReturnType<typeof createConceptsApi>;
