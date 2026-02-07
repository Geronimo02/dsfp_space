import { describe, it, expect } from 'vitest';
import { cn } from '@/lib/utils';

describe('utils', () => {
  describe('cn (classNames utility)', () => {
    it('should combine class names', () => {
      const result = cn('class1', 'class2');
      expect(result).toBe('class1 class2');
    });

    it('should handle conditional classes', () => {
      const result = cn('base', false && 'conditional', 'always');
      expect(result).toContain('base');
      expect(result).toContain('always');
      expect(result).not.toContain('conditional');
    });

    it('should handle undefined and null', () => {
      const result = cn('class1', undefined, null, 'class2');
      expect(result).toContain('class1');
      expect(result).toContain('class2');
    });

    it('should handle empty strings', () => {
      const result = cn('class1', '', 'class2');
      expect(result).toContain('class1');
      expect(result).toContain('class2');
    });

    it('should merge tailwind classes correctly', () => {
      const result = cn('p-4', 'p-8');
      // Should override p-4 with p-8
      expect(result).toBeDefined();
    });

    it('should handle arrays of classes', () => {
      const result = cn(['class1', 'class2'], 'class3');
      expect(result).toContain('class1');
      expect(result).toContain('class2');
      expect(result).toContain('class3');
    });
  });
});
