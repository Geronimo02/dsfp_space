import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useRateLimit } from '@/hooks/useRateLimit';

// Mock toast
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

describe('useRateLimit', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('should allow operations within limit', async () => {
    const { result } = renderHook(() => useRateLimit(3, 60000)); // 3 per minute

    const mockFn = vi.fn().mockResolvedValue('success');

    await act(async () => {
      const result1 = await result.current.execute(mockFn);
      expect(result1).toBe('success');
    });

    await act(async () => {
      const result2 = await result.current.execute(mockFn);
      expect(result2).toBe('success');
    });

    await act(async () => {
      const result3 = await result.current.execute(mockFn);
      expect(result3).toBe('success');
    });

    expect(mockFn).toHaveBeenCalledTimes(3);
  });

  it('should block operations exceeding limit', async () => {
    const { result } = renderHook(() => useRateLimit(2, 60000)); // 2 per minute

    const mockFn = vi.fn().mockResolvedValue('success');

    await act(async () => {
      await result.current.execute(mockFn);
      await result.current.execute(mockFn);
    });

    await act(async () => {
      const result3 = await result.current.execute(mockFn);
      expect(result3).toBeNull(); // Should be blocked
    });

    expect(mockFn).toHaveBeenCalledTimes(2);
  });

  it('should reset after time window', async () => {
    const { result } = renderHook(() => useRateLimit(2, 1000)); // 2 per second

    const mockFn = vi.fn().mockResolvedValue('success');

    await act(async () => {
      await result.current.execute(mockFn);
      await result.current.execute(mockFn);
    });

    // Fast forward time
    act(() => {
      vi.advanceTimersByTime(1100);
    });

    await act(async () => {
      const result3 = await result.current.execute(mockFn);
      expect(result3).toBe('success'); // Should work again
    });

    expect(mockFn).toHaveBeenCalledTimes(3);
  });

  it('should track remaining attempts correctly', async () => {
    const { result } = renderHook(() => useRateLimit(3, 60000));

    expect(result.current.getRemainingAttempts()).toBe(3);

    const mockFn = vi.fn().mockResolvedValue('success');

    await act(async () => {
      await result.current.execute(mockFn);
    });

    await waitFor(() => {
      expect(result.current.getRemainingAttempts()).toBe(2);
    });

    await act(async () => {
      await result.current.execute(mockFn);
    });

    await waitFor(() => {
      expect(result.current.getRemainingAttempts()).toBe(1);
    });
  });

  it('should allow manual reset', async () => {
    const { result } = renderHook(() => useRateLimit(2, 60000));

    const mockFn = vi.fn().mockResolvedValue('success');

    await act(async () => {
      await result.current.execute(mockFn);
      await result.current.execute(mockFn);
    });

    expect(result.current.getRemainingAttempts()).toBe(0);

    act(() => {
      result.current.reset();
    });

    expect(result.current.getRemainingAttempts()).toBe(2);

    await act(async () => {
      const result3 = await result.current.execute(mockFn);
      expect(result3).toBe('success');
    });

    expect(mockFn).toHaveBeenCalledTimes(3);
  });

  it('should handle async function errors', async () => {
    const { result } = renderHook(() => useRateLimit(3, 60000));

    const mockFn = vi.fn().mockRejectedValue(new Error('Test error'));

    await act(async () => {
      try {
        await result.current.execute(mockFn);
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
      }
    });

    // Should still count as an attempt
    expect(result.current.getRemainingAttempts()).toBe(2);
  });
});
