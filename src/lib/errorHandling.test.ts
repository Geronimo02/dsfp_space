import { describe, it, expect } from 'vitest';
import { getErrorMessage, ErrorMessages } from '../errorHandling';

describe('errorHandling', () => {
  describe('getErrorMessage', () => {
    it('should handle Supabase error codes', () => {
      const error = { code: '23505', message: 'duplicate key value' };
      const message = getErrorMessage(error);
      expect(message).toBe(ErrorMessages.DUPLICATE_ENTRY);
    });

    it('should handle foreign key errors', () => {
      const error = { code: '23503', message: 'foreign key violation' };
      const message = getErrorMessage(error);
      expect(message).toBe(ErrorMessages.REFERENCE_ERROR);
    });

    it('should handle permission errors', () => {
      const error = { code: '42501', message: 'permission denied' };
      const message = getErrorMessage(error);
      expect(message).toBe(ErrorMessages.PERMISSION_DENIED);
    });

    it('should handle RLS policy errors', () => {
      const error = { message: 'new row violates row-level security policy' };
      const message = getErrorMessage(error);
      expect(message).toBe(ErrorMessages.PERMISSION_DENIED);
    });

    it('should handle network errors', () => {
      const error = new Error('Failed to fetch');
      const message = getErrorMessage(error);
      expect(message).toBe(ErrorMessages.NETWORK_ERROR);
    });

    it('should handle timeout errors', () => {
      const error = new Error('Request timeout');
      const message = getErrorMessage(error);
      expect(message).toBe(ErrorMessages.TIMEOUT);
    });

    it('should handle validation errors', () => {
      const error = new Error('Validation failed');
      const message = getErrorMessage(error);
      expect(message).toBe(ErrorMessages.VALIDATION_ERROR);
    });

    it('should handle authentication errors', () => {
      const error = { message: 'Invalid credentials' };
      const message = getErrorMessage(error);
      expect(message).toBe(ErrorMessages.INVALID_CREDENTIALS);
    });

    it('should return error message if present', () => {
      const error = { message: 'Custom error message' };
      const message = getErrorMessage(error);
      expect(message).toBe('Custom error message');
    });

    it('should return generic error for unknown errors', () => {
      const error = { unknown: 'error' };
      const message = getErrorMessage(error);
      expect(message).toBe(ErrorMessages.GENERIC);
    });

    it('should handle string errors', () => {
      const message = getErrorMessage('Simple error string');
      expect(message).toBe('Simple error string');
    });

    it('should handle Error instances', () => {
      const error = new Error('Error instance message');
      const message = getErrorMessage(error);
      expect(message).toBe('Error instance message');
    });

    it('should handle null/undefined', () => {
      expect(getErrorMessage(null)).toBe(ErrorMessages.GENERIC);
      expect(getErrorMessage(undefined)).toBe(ErrorMessages.GENERIC);
    });

    it('should handle rate limit errors', () => {
      const error = { message: 'Too many requests' };
      const message = getErrorMessage(error);
      expect(message).toContain('Demasiadas operaciones');
    });
  });
});
