import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createProvenanceApi } from '../provenance';
import type { ApiClient } from '../client';

describe('Provenance API', () => {
  let mockClient: ApiClient;
  let provenanceApi: ReturnType<typeof createProvenanceApi>;

  beforeEach(() => {
    mockClient = {
      get: vi.fn(),
      post: vi.fn(),
      patch: vi.fn(),
      delete: vi.fn(),
      put: vi.fn(),
    } as unknown as ApiClient;
    provenanceApi = createProvenanceApi(mockClient);
  });

  it('gets note provenance by note id', async () => {
    vi.mocked(mockClient.get).mockResolvedValueOnce({
      note_id: 'note-1',
      provenance: [],
    });

    await provenanceApi.getProvenance('note-1');

    expect(mockClient.get).toHaveBeenCalledWith('/notes/note-1/provenance');
  });

  it('creates a provenance location', async () => {
    vi.mocked(mockClient.post).mockResolvedValueOnce({ id: 'location-1' });

    const request = {
      latitude: 48.8584,
      longitude: 2.2945,
      altitude_m: 35,
      source: 'gps_exif',
      confidence: 'high',
    };

    const result = await provenanceApi.createLocation(request);

    expect(mockClient.post).toHaveBeenCalledWith('/provenance/locations', request);
    expect(result).toEqual({ id: 'location-1' });
  });

  it('creates a named location', async () => {
    vi.mocked(mockClient.post).mockResolvedValueOnce({ id: 'named-location-1' });

    const request = {
      name: 'Eiffel Tower',
      location_type: 'poi',
      latitude: 48.8584,
      longitude: 2.2945,
      radius_m: 150,
      locality: 'Paris',
      country: 'France',
      is_private: false,
      metadata: { wikidata: 'Q243' },
    };

    await provenanceApi.createNamedLocation(request);

    expect(mockClient.post).toHaveBeenCalledWith('/provenance/named-locations', request);
  });

  it('creates a provenance device', async () => {
    vi.mocked(mockClient.post).mockResolvedValueOnce({
      id: 'device-1',
      device_make: 'Apple',
      device_model: 'iPhone 15 Pro',
    });

    const request = {
      device_make: 'Apple',
      device_model: 'iPhone 15 Pro',
      device_os: 'iOS',
      device_os_version: '18.1',
      software: 'Camera',
      has_gps: true,
      sensor_metadata: { lens: 'wide' },
    };

    await provenanceApi.createDevice(request);

    expect(mockClient.post).toHaveBeenCalledWith('/provenance/devices', request);
  });

  it('creates file provenance for an attachment', async () => {
    vi.mocked(mockClient.post).mockResolvedValueOnce({ id: 'file-provenance-1' });

    const request = {
      attachment_id: 'attachment-1',
      note_id: 'note-1',
      capture_time_start: '2026-07-14T12:00:00Z',
      capture_timezone: 'Europe/Paris',
      time_source: 'exif',
      time_confidence: 'high',
      location_id: 'location-1',
      device_id: 'device-1',
      event_type: 'photo',
      event_title: 'Eiffel Tower Visit',
      raw_metadata: { exposure: '1/250' },
    };

    await provenanceApi.createFileProvenance(request);

    expect(mockClient.post).toHaveBeenCalledWith('/provenance/files', request);
  });

  it('creates note provenance', async () => {
    vi.mocked(mockClient.post).mockResolvedValueOnce({ id: 'note-provenance-1' });

    const request = {
      note_id: 'note-1',
      capture_time_start: '2026-07-14T12:00:00Z',
      capture_time_end: '2026-07-14T13:00:00Z',
      capture_timezone: 'Europe/Paris',
      time_source: 'manual',
      time_confidence: 'exact',
      location_id: 'location-1',
      device_id: 'device-1',
      event_type: 'created',
      event_description: 'Created during field notes import',
    };

    await provenanceApi.createNoteProvenance(request);

    expect(mockClient.post).toHaveBeenCalledWith('/provenance/notes', request);
  });

  it('validates required identifiers and coordinates before calling the API', async () => {
    await expect(provenanceApi.getProvenance('')).rejects.toThrow('Note ID is required');
    await expect(provenanceApi.createLocation({
      latitude: Number.NaN,
      longitude: 2.2945,
      source: 'gps_exif',
      confidence: 'high',
    })).rejects.toThrow('Latitude is required');
    await expect(provenanceApi.createNamedLocation({
      name: '',
      location_type: 'poi',
      latitude: 48.8584,
      longitude: 2.2945,
    })).rejects.toThrow('Location name is required');
    await expect(provenanceApi.createDevice({
      device_make: 'Apple',
      device_model: '',
    })).rejects.toThrow('Device model is required');
    await expect(provenanceApi.createFileProvenance({
      attachment_id: '',
    })).rejects.toThrow('Attachment ID is required');
    await expect(provenanceApi.createNoteProvenance({
      note_id: '',
    })).rejects.toThrow('Note ID is required');

    expect(mockClient.get).not.toHaveBeenCalled();
    expect(mockClient.post).not.toHaveBeenCalled();
  });
});
