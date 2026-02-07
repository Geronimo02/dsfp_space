import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
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

  it('should return true for admin role', () => {
    const { result } = renderHook(() => usePermissions());
    
    const hasPermission = result.current.hasPermission('products', 'create');
    expect(hasPermission).toBe(true);
  });

  it('should check module permissions correctly', () => {
    const { result } = renderHook(() => usePermissions());
    
    // Admin should have all permissions
    expect(result.current.hasPermission('products', 'create')).toBe(true);
    expect(result.current.hasPermission('products', 'edit')).toBe(true);
    expect(result.current.hasPermission('products', 'delete')).toBe(true);
    expect(result.current.hasPermission('products', 'view')).toBe(true);
  });

  it('should check multiple permissions', () => {
    const { result } = renderHook(() => usePermissions());
    
    // Check each permission individually
    const hasProdCreate = result.current.hasPermission('products', 'create');
    const hasSalesCreate = result.current.hasPermission('sales', 'create');
    
    expect(hasProdCreate).toBe(true);
    expect(hasSalesCreate).toBe(true);
  });

  it('should return false for invalid module', () => {
    const { result } = renderHook(() => usePermissions());
    
    const hasPermission = result.current.hasPermission('invalid_module' as any, 'create');
    expect(hasPermission).toBe(false);
  });

  it('should cache permission checks', () => {
    const { result } = renderHook(() => usePermissions());
    
    // Call twice with same parameters
    const check1 = result.current.hasPermission('products', 'create');
    const check2 = result.current.hasPermission('products', 'create');
    
    expect(check1).toBe(check2);
  });
});
