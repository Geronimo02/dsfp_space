import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useDebounce } from '../useDebounce';

describe('useDebounce', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should return initial value immediately', () => {
    const { result } = renderHook(() => useDebounce('test', 500));
    expect(result.current).toBe('test');
  });

  it('should debounce value changes', async () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: 'initial', delay: 500 } }
    );

    expect(result.current).toBe('initial');

    // Change value
    rerender({ value: 'updated', delay: 500 });
    expect(result.current).toBe('initial'); // Still old value

    // Fast forward time
    vi.advanceTimersByTime(499);
    expect(result.current).toBe('initial'); // Still old value

    vi.advanceTimersByTime(1);
    await waitFor(() => {
      expect(result.current).toBe('updated'); // Now updated
    });
  });

  it('should cancel previous timeout on rapid changes', async () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, 500),
      { initialProps: { value: 'first' } }
    );

    rerender({ value: 'second' });
    vi.advanceTimersByTime(200);
    
    rerender({ value: 'third' });
    vi.advanceTimersByTime(200);
    
    rerender({ value: 'fourth' });
    vi.advanceTimersByTime(500);

    await waitFor(() => {
      expect(result.current).toBe('fourth');
    });
  });

  it('should work with different data types', async () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, 300),
      { initialProps: { value: 123 } }
    );

    expect(result.current).toBe(123);

    rerender({ value: 456 });
    vi.advanceTimersByTime(300);

    await waitFor(() => {
      expect(result.current).toBe(456);
    });
  });

  it('should handle zero delay', async () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, 0),
      { initialProps: { value: 'test' } }
    );

    rerender({ value: 'updated' });
    
    await waitFor(() => {
      expect(result.current).toBe('updated');
    });
  });
});
