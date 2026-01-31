import { describe, it, expect } from 'vitest';
import {
  ApiError,
  NetworkError,
  ValidationError,
  NotFoundError,
  isApiError
} from '../errors';

describe('API Errors', () => {
  describe('ApiError', () => {
    it('creates error with message and status code', () => {
      const error = new ApiError('Not found', 404);

      expect(error.message).toBe('Not found');
      expect(error.statusCode).toBe(404);
      expect(error.name).toBe('ApiError');
      expect(error instanceof Error).toBe(true);
    });

    it('includes response data when provided', () => {
      const responseData = { error: 'Invalid request', field: 'content' };
      const error = new ApiError('Validation failed', 400, responseData);

      expect(error.response).toEqual(responseData);
    });

    it('has undefined response when not provided', () => {
      const error = new ApiError('Server error', 500);

      expect(error.response).toBeUndefined();
    });
  });

  describe('NetworkError', () => {
    it('creates network error from Error object', () => {
      const originalError = new Error('Connection refused');
      const error = new NetworkError(originalError);

      expect(error.message).toBe('Network request failed: Connection refused');
      expect(error.name).toBe('NetworkError');
      expect(error.originalError).toBe(originalError);
    });

    it('creates network error from string message', () => {
      const error = new NetworkError('Timeout');

      expect(error.message).toBe('Network request failed: Timeout');
      expect(error.originalError).toBeInstanceOf(Error);
    });
  });

  describe('ValidationError', () => {
    it('creates validation error with field errors', () => {
      const fieldErrors = {
        content: 'Content is required',
        title: 'Title too long'
      };
      const error = new ValidationError('Validation failed', fieldErrors);

      expect(error.message).toBe('Validation failed');
      expect(error.statusCode).toBe(400);
      expect(error.fields).toEqual(fieldErrors);
    });

    it('has empty fields when not provided', () => {
      const error = new ValidationError('Invalid input');

      expect(error.fields).toEqual({});
    });
  });

  describe('NotFoundError', () => {
    it('creates not found error with resource info', () => {
      const error = new NotFoundError('note', 'abc123');

      expect(error.message).toBe('note not found: abc123');
      expect(error.statusCode).toBe(404);
      expect(error.resourceType).toBe('note');
      expect(error.resourceId).toBe('abc123');
    });
  });

  describe('isApiError', () => {
    it('returns true for ApiError instances', () => {
      const error = new ApiError('Error', 500);

      expect(isApiError(error)).toBe(true);
    });

    it('returns true for subclass instances', () => {
      const validationError = new ValidationError('Validation failed');
      const notFoundError = new NotFoundError('note', '123');

      expect(isApiError(validationError)).toBe(true);
      expect(isApiError(notFoundError)).toBe(true);
    });

    it('returns false for regular Error instances', () => {
      const error = new Error('Regular error');

      expect(isApiError(error)).toBe(false);
    });

    it('returns false for non-error values', () => {
      expect(isApiError(null)).toBe(false);
      expect(isApiError(undefined)).toBe(false);
      expect(isApiError('string')).toBe(false);
      expect(isApiError({})).toBe(false);
    });
  });
});
