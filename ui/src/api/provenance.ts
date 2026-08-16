/**
 * Provenance API client
 * Handles W3C PROV provenance tracking for notes
 */

import type { ApiClient } from './client';
import type { ProvenanceResponse } from './types-extended';
import { asRecord, requiredString } from './contract-codecs';

export interface CreateProvLocationRequest {
  latitude: number;
  longitude: number;
  altitude_m?: number | null;
  horizontal_accuracy_m?: number | null;
  vertical_accuracy_m?: number | null;
  heading_degrees?: number | null;
  speed_mps?: number | null;
  named_location_id?: string | null;
  source: 'gps_exif' | 'device_api' | 'user_manual' | 'geocoded' | 'ai_estimated' | string;
  confidence: 'high' | 'medium' | 'low' | 'unknown' | string;
}

export interface CreateNamedLocationRequest {
  name: string;
  location_type: 'home' | 'work' | 'poi' | 'city' | 'region' | 'country' | string;
  latitude: number;
  longitude: number;
  radius_m?: number | null;
  address_line?: string | null;
  locality?: string | null;
  admin_area?: string | null;
  country?: string | null;
  country_code?: string | null;
  postal_code?: string | null;
  timezone?: string | null;
  altitude_m?: number | null;
  is_private?: boolean | null;
  metadata?: Record<string, unknown> | null;
}

export interface CreateProvDeviceRequest {
  device_make: string;
  device_model: string;
  device_os?: string | null;
  device_os_version?: string | null;
  software?: string | null;
  software_version?: string | null;
  has_gps?: boolean | null;
  has_accelerometer?: boolean | null;
  sensor_metadata?: Record<string, unknown> | null;
  device_name?: string | null;
}

export interface CreateFileProvenanceRequest {
  attachment_id: string;
  note_id?: string | null;
  capture_time_start?: string | null;
  capture_time_end?: string | null;
  capture_timezone?: string | null;
  capture_duration_seconds?: number | null;
  time_source?: 'exif' | 'file_mtime' | 'user_manual' | 'ai_estimated' | 'device_clock' | string | null;
  time_confidence?: 'high' | 'medium' | 'low' | 'unknown' | string | null;
  location_id?: string | null;
  device_id?: string | null;
  event_type?: 'photo' | 'video' | 'audio' | 'scan' | 'screenshot' | 'recording' | string | null;
  event_title?: string | null;
  event_description?: string | null;
  raw_metadata?: Record<string, unknown> | null;
}

export interface CreateNoteProvenanceRequest {
  note_id: string;
  capture_time_start?: string | null;
  capture_time_end?: string | null;
  capture_timezone?: string | null;
  time_source?: 'gps' | 'network' | 'manual' | 'file_metadata' | 'device_clock' | string | null;
  time_confidence?: 'exact' | 'approximate' | 'estimated' | string | null;
  location_id?: string | null;
  device_id?: string | null;
  event_type?: 'created' | 'modified' | 'accessed' | 'shared' | string | null;
  event_title?: string | null;
  event_description?: string | null;
}

export interface ProvenanceCreatedResponse {
  id: string;
  [key: string]: unknown;
}

function decodeCreated(payload: unknown, operationId: string): ProvenanceCreatedResponse {
  const raw = asRecord(payload, operationId);
  return { ...raw, id: requiredString(raw, 'id', operationId) };
}

function requireId(value: string, message: string) {
  if (!value || value.trim() === '') {
    throw new Error(message);
  }
}

function requireFiniteCoordinate(value: number, message: string) {
  if (!Number.isFinite(value)) {
    throw new Error(message);
  }
}

export function createProvenanceApi(client: ApiClient) {
  return {
    /**
     * Get full provenance chain for a note
     * Returns W3C PROV-compliant activity chain
     * Includes AI processing, device info, and location context
     */
    async getProvenance(noteId: string): Promise<ProvenanceResponse> {
      requireId(noteId, 'Note ID is required');

      return client.get<ProvenanceResponse>(
        `/notes/${noteId}/provenance`
      );
    },

    async createLocation(request: CreateProvLocationRequest): Promise<ProvenanceCreatedResponse> {
      requireFiniteCoordinate(request.latitude, 'Latitude is required');
      requireFiniteCoordinate(request.longitude, 'Longitude is required');
      requireId(request.source, 'Location source is required');
      requireId(request.confidence, 'Location confidence is required');

      return decodeCreated(await client.post<unknown>('/provenance/locations', request), 'create_prov_location');
    },

    async createNamedLocation(request: CreateNamedLocationRequest): Promise<ProvenanceCreatedResponse> {
      requireId(request.name, 'Location name is required');
      requireId(request.location_type, 'Location type is required');
      requireFiniteCoordinate(request.latitude, 'Latitude is required');
      requireFiniteCoordinate(request.longitude, 'Longitude is required');

      return decodeCreated(await client.post<unknown>('/provenance/named-locations', request), 'create_named_location');
    },

    async createDevice(request: CreateProvDeviceRequest): Promise<ProvenanceCreatedResponse> {
      requireId(request.device_make, 'Device make is required');
      requireId(request.device_model, 'Device model is required');

      return decodeCreated(await client.post<unknown>('/provenance/devices', request), 'create_prov_device');
    },

    async createFileProvenance(request: CreateFileProvenanceRequest): Promise<ProvenanceCreatedResponse> {
      requireId(request.attachment_id, 'Attachment ID is required');

      return decodeCreated(await client.post<unknown>('/provenance/files', request), 'create_file_provenance');
    },

    async createNoteProvenance(request: CreateNoteProvenanceRequest): Promise<ProvenanceCreatedResponse> {
      requireId(request.note_id, 'Note ID is required');

      return decodeCreated(await client.post<unknown>('/provenance/notes', request), 'create_note_provenance');
    },
  };
}

export type ProvenanceApi = ReturnType<typeof createProvenanceApi>;
