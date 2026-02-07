import { describe, it, expect } from 'vitest';
import {
  QUERY_LIMITS,
  sanitizeSearchQuery,
  buildSearchFilter,
  checkQueryLimit,
} from '@/lib/queryHelpers';

describe('queryHelpers', () => {
  describe('QUERY_LIMITS', () => {
    it('should have correct default limits', () => {
      expect(QUERY_LIMITS.DEFAULT).toBe(100);
      expect(QUERY_LIMITS.LIST).toBe(500);
      expect(QUERY_LIMITS.LARGE_LIST).toBe(1000);
      expect(QUERY_LIMITS.SEARCH).toBe(50);
      expect(QUERY_LIMITS.RECENT).toBe(20);
      expect(QUERY_LIMITS.SINGLE).toBe(1);
    });
  });

  describe('sanitizeSearchQuery', () => {
    it('should return null for empty string', () => {
      expect(sanitizeSearchQuery('')).toBeNull();
      expect(sanitizeSearchQuery('   ')).toBeNull();
    });

    it('should return null for null/undefined', () => {
      expect(sanitizeSearchQuery(null)).toBeNull();
      expect(sanitizeSearchQuery(undefined)).toBeNull();
    });

    it('should trim whitespace', () => {
      expect(sanitizeSearchQuery('  hello  ')).toBe('hello');
    });

    it('should remove SQL injection characters', () => {
      expect(sanitizeSearchQuery("test'; DROP TABLE--")).toBe('test DROP TABLE--');
      expect(sanitizeSearchQuery('test"')).toBe('test');
      expect(sanitizeSearchQuery('test\\')).toBe('test');
    });

    it('should limit string length to 100 characters', () => {
      const longString = 'a'.repeat(150);
      const result = sanitizeSearchQuery(longString);
      expect(result?.length).toBe(100);
    });

    it('should handle normal queries', () => {
      expect(sanitizeSearchQuery('product name')).toBe('product name');
      expect(sanitizeSearchQuery('John Doe')).toBe('John Doe');
      expect(sanitizeSearchQuery('123-456')).toBe('123-456');
    });
  });

  describe('buildSearchFilter', () => {
    it('should return null for empty search term', () => {
      expect(buildSearchFilter('name', '')).toBeNull();
      expect(buildSearchFilter('name', null)).toBeNull();
      expect(buildSearchFilter('name', undefined)).toBeNull();
    });

    it('should build correct filter object', () => {
      const result = buildSearchFilter('name', 'John');
      expect(result).toEqual({
        column: 'name',
        pattern: '%John%',
      });
    });

    it('should sanitize search term', () => {
      const result = buildSearchFilter('name', "John'; DROP--");
      expect(result?.pattern).toBe('%John DROP--%');
    });
  });

  describe('checkQueryLimit', () => {
    it('should return null when under limit', () => {
      expect(checkQueryLimit(50, 100)).toBeNull();
      expect(checkQueryLimit(0, 100)).toBeNull();
    });

    it('should return warning when limit is reached', () => {
      const result = checkQueryLimit(100, 100);
      expect(result).toContain('Se alcanzó el límite');
      expect(result).toContain('100 registros');
    });

    it('should return warning when over limit', () => {
      const result = checkQueryLimit(150, 100);
      expect(result).toContain('Se alcanzó el límite');
    });
  });
});
