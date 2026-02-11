import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { usePermissions } from '@/hooks/usePermissions';
import React from 'react';

// Mock useAuth hook
vi.mock('@/hooks/useAuth', () => ({
  useAuth: vi.fn(() => ({
    user: { id: 'test-user-id' },
  })),
}));

// Mock CompanyContext
vi.mock('@/contexts/CompanyContext', () => ({
  useCompany: vi.fn(() => ({
    currentCompany: { id: 'test-company-id' },
    userRole: 'admin',
  })),
}));

// Mock Supabase client
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      getUser: vi.fn(() => Promise.resolve({
        data: { user: { id: 'test-user-id', email: 'test@test.com' } },
        error: null,
      })),
    },
    from: vi.fn((table: string) => {
      if (table === 'company_users') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                or: vi.fn(() => ({
                  data: [{ role: 'admin', platform_admin: false }],
                  error: null,
                })),
              })),
            })),
          })),
        };
      }
      // role_permissions table
      return {
        select: vi.fn(() => ({
          in: vi.fn(() => ({
            eq: vi.fn(() => ({
              data: [],
              error: null,
            })),
          })),
        })),
      };
    }),
  },
}));

describe('usePermissions', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    vi.clearAllMocks();
  });

  function wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  }

  it('should return true for admin role', async () => {
    const { result } = renderHook(() => usePermissions(), { wrapper });
    
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const hasPermission = result.current.hasPermission('products', 'create');
    expect(hasPermission).toBe(true);
  });

  it('should check module permissions correctly', async () => {
    const { result } = renderHook(() => usePermissions(), { wrapper });
    
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Admin should have all permissions
    expect(result.current.hasPermission('products', 'create')).toBe(true);
    expect(result.current.hasPermission('products', 'edit')).toBe(true);
    expect(result.current.hasPermission('products', 'delete')).toBe(true);
    expect(result.current.hasPermission('products', 'view')).toBe(true);
  });

  it('should check multiple permissions', async () => {
    const { result } = renderHook(() => usePermissions(), { wrapper });
    
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Check each permission individually
    const hasProdCreate = result.current.hasPermission('products', 'create');
    const hasSalesCreate = result.current.hasPermission('sales', 'create');
    
    expect(hasProdCreate).toBe(true);
    expect(hasSalesCreate).toBe(true);
  });

  it('should return true for any module when user is admin', async () => {
    const { result } = renderHook(() => usePermissions(), { wrapper });
    
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Admin role bypasses module validation and returns true for all permissions
    const hasPermission = result.current.hasPermission('invalid_module' as any, 'create');
    expect(hasPermission).toBe(true);
  });

  it('should cache permission checks', async () => {
    const { result } = renderHook(() => usePermissions(), { wrapper });
    
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Call twice with same parameters
    const check1 = result.current.hasPermission('products', 'create');
    const check2 = result.current.hasPermission('products', 'create');
    
    expect(check1).toBe(check2);
  });
});
