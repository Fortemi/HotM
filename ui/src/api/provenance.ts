/**
 * Provenance API client
 * Handles W3C PROV provenance tracking for notes
 */

import type { ApiClient } from './client';
import type { ProvenanceResponse } from './types-extended';

export function createProvenanceApi(client: ApiClient) {
  return {
    /**
     * Get full provenance chain for a note
     * Returns W3C PROV-compliant activity chain
     * Includes AI processing, device info, and location context
     */
    async getProvenance(noteId: string): Promise<ProvenanceResponse> {
      if (!noteId || noteId.trim() === '') {
        throw new Error('Note ID is required');
      }

      return client.get<ProvenanceResponse>(
        `/notes/${noteId}/provenance`
      );
    },
  };
}

export type ProvenanceApi = ReturnType<typeof createProvenanceApi>;
