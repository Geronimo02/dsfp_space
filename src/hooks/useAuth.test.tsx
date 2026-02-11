import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import type { AuthError } from '@supabase/supabase-js';
import React from 'react';

// Mock Supabase client
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      getUser: vi.fn(),
      getSession: vi.fn(() => Promise.resolve({ data: { session: null }, error: null })),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
      signOut: vi.fn(),
    },
  },
}));

describe('useAuth', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    vi.clearAllMocks();
  });

  function wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  }

  it('should return loading state initially', () => {
    vi.mocked(supabase.auth.getUser).mockResolvedValue({
      data: { user: null },
      error: null,
    });

    const { result } = renderHook(() => useAuth(), { wrapper });

    expect(result.current.isLoading).toBe(true);
  });

  it('should return user when authenticated', async () => {
    const mockUser = {
      id: '123',
      email: 'test@example.com',
      app_metadata: {},
      user_metadata: {},
      aud: 'authenticated',
      created_at: new Date().toISOString(),
    };

    vi.mocked(supabase.auth.getUser).mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.user).toEqual(mockUser);
    expect(result.current.isAuthenticated).toBe(true);
  });

  it('should return null user when not authenticated', async () => {
    vi.mocked(supabase.auth.getUser).mockResolvedValue({
      data: { user: null },
      error: null,
    });

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.user).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
  });

  it('should handle signOut correctly', async () => {
    vi.mocked(supabase.auth.getUser).mockResolvedValue({
      data: { user: { id: '123' } as any },
      error: null,
    });

    vi.mocked(supabase.auth.signOut).mockResolvedValue({
      error: null,
    });

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const signOutResult = await result.current.signOut();

    expect(signOutResult.error).toBeNull();
    expect(supabase.auth.signOut).toHaveBeenCalled();
  });

  it('should handle auth errors', async () => {
    const mockError: AuthError = {
      name: 'AuthApiError',
      message: 'Auth failed',
      status: 401,
      code: 'auth_error',
    } as AuthError;

    vi.mocked(supabase.auth.getUser).mockResolvedValue({
      data: { user: null },
      error: mockError,
    });

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    }, { timeout: 10000 });

    expect(result.current.error).toBeTruthy();
  });

  it('should cache user data', async () => {
    const mockUser = {
      id: '123',
      email: 'test@example.com',
    } as any;

    vi.mocked(supabase.auth.getUser).mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });

    const { result: result1 } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result1.current.isLoading).toBe(false));

    // Second hook should use cached data
    const { result: result2 } = renderHook(() => useAuth(), { wrapper });

    // Should not call getUser again (cached)
    expect(result2.current.user).toEqual(mockUser);
  });
});
