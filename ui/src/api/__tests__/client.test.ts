import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createApiClient } from '../client';
import { ApiError, NetworkError } from '../errors';
import { clearActiveMemory, setActiveMemory } from '../memory-context';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('API Client', () => {
  const baseUrl = 'http://localhost:3000';
  let client: ReturnType<typeof createApiClient>;

  beforeEach(() => {
    mockFetch.mockClear();
    clearActiveMemory();
    client = createApiClient(baseUrl);
  });

  describe('GET requests', () => {
    it('makes successful GET request', async () => {
      const mockData = { id: '123', title: 'Test' };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockData)
      });

      const result = await client.get('/test');

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3000/test',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'Content-Type': 'application/json'
          })
        })
      );
      expect(result).toEqual(mockData);
    });

    it('includes query parameters', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({})
      });

      await client.get('/search', { q: 'test', limit: '10' });

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3000/search?q=test&limit=10',
        expect.any(Object)
      );
    });

    it('handles empty query parameters', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({})
      });

      await client.get('/notes', {});

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3000/notes',
        expect.any(Object)
      );
    });

    it('adds memory routing header for API v1 paths when memory is selected', async () => {
      setActiveMemory('projecte');
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({})
      });

      await client.get('/api/v1/notes');

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/v1/notes',
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-Fortemi-Memory': 'projecte'
          })
        })
      );
    });

    it('does not add memory routing header for non-API v1 paths', async () => {
      setActiveMemory('projecte');
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({})
      });

      await client.get('/health');

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3000/health',
        expect.objectContaining({
          headers: expect.not.objectContaining({
            'X-Fortemi-Memory': expect.any(String)
          })
        })
      );
    });
  });

  describe('POST requests', () => {
    it('makes successful POST request with body', async () => {
      const mockResponse = { id: 'new-id' };
      const requestBody = { content: 'Test content' };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: () => Promise.resolve(mockResponse)
      });

      const result = await client.post('/notes', requestBody);

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3000/notes',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json'
          }),
          body: JSON.stringify(requestBody)
        })
      );
      expect(result).toEqual(mockResponse);
    });

    it('handles POST without body', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({})
      });

      await client.post('/action');

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3000/action',
        expect.objectContaining({
          method: 'POST',
          body: undefined
        })
      );
    });
  });

  describe('PATCH requests', () => {
    it('makes successful PATCH request', async () => {
      const mockResponse = { id: '123', updated: true };
      const updateData = { title: 'Updated' };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      const result = await client.patch('/notes/123', updateData);

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3000/notes/123',
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify(updateData)
        })
      );
      expect(result).toEqual(mockResponse);
    });
  });

  describe('DELETE requests', () => {
    it('makes successful DELETE request', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 204,
        json: () => Promise.resolve(null)
      });

      await client.delete('/notes/123');

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3000/notes/123',
        expect.objectContaining({
          method: 'DELETE'
        })
      );
    });

    it('handles 204 No Content response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 204,
        json: () => Promise.reject(new Error('No content'))
      });

      const result = await client.delete('/notes/123');

      expect(result).toBeNull();
    });
  });

  describe('Error handling', () => {
    it('throws ApiError for HTTP error responses', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: () => Promise.resolve({ error: 'Resource not found' })
      });

      try {
        await client.get('/notes/invalid');
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError);
        if (error instanceof ApiError) {
          expect(error.statusCode).toBe(404);
        }
      }
    });

    it('throws NetworkError for network failures', async () => {
      // Mock all retries to fail
      mockFetch.mockRejectedValue(new Error('Failed to fetch'));

      await expect(client.get('/notes')).rejects.toThrow(NetworkError);
    }, 15000);

    it('handles JSON parse errors', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.reject(new Error('Invalid JSON'))
      });

      await expect(client.get('/notes')).rejects.toThrow();
    }, 15000);

    it('includes response body in ApiError when available', async () => {
      const errorBody = { error: 'Validation failed', fields: { content: 'Required' } };
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        json: () => Promise.resolve(errorBody)
      });

      try {
        await client.get('/test');
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError);
        if (error instanceof ApiError) {
          expect(error.response).toEqual(errorBody);
        }
      }
    });
  });

  describe('Retry logic', () => {
    it('retries failed requests with exponential backoff', async () => {
      // First two calls fail, third succeeds
      mockFetch
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ success: true })
        });

      const result = await client.get('/test');

      expect(mockFetch).toHaveBeenCalledTimes(3);
      expect(result).toEqual({ success: true });
    }, 30000); // Increase timeout for retry delays

    it('gives up after max retries', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      await expect(client.get('/test')).rejects.toThrow(NetworkError);

      // Default is 3 retries = 4 total attempts
      expect(mockFetch).toHaveBeenCalledTimes(4);
    }, 30000);

    it('does not retry 4xx client errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        json: () => Promise.resolve({ error: 'Invalid request' })
      });

      await expect(client.get('/test')).rejects.toThrow(ApiError);

      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('retries 5xx server errors', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
          json: () => Promise.resolve({})
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ success: true })
        });

      const result = await client.get('/test');

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(result).toEqual({ success: true });
    }, 30000);
  });

  describe('Custom headers', () => {
    it('merges custom headers with defaults', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({})
      });

      await client.get('/test', undefined, {
        'Authorization': 'Bearer token123',
        'X-Custom': 'value'
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'Authorization': 'Bearer token123',
            'X-Custom': 'value'
          })
        })
      );
    });

    it('allows overriding default headers', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({})
      });

      await client.get('/test', undefined, {
        'Content-Type': 'text/plain'
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'text/plain'
          })
        })
      );
    });
  });

  describe('Base URL handling', () => {
    it('handles base URL with trailing slash', () => {
      const clientWithSlash = createApiClient('http://localhost:3000/');
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({})
      });

      clientWithSlash.get('/test');

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3000/test',
        expect.any(Object)
      );
    });

    it('handles path without leading slash', () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({})
      });

      client.get('test');

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3000/test',
        expect.any(Object)
      );
    });
  });
});
