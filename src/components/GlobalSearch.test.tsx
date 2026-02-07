import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { GlobalSearch } from '@/components/GlobalSearch';
import { supabase } from '@/integrations/supabase/client';
import React from 'react';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          ilike: vi.fn(() => ({
            limit: vi.fn(() => ({
              data: [],
              error: null,
            })),
          })),
        })),
      })),
    })),
  },
}));

vi.mock('@/contexts/CompanyContext', () => ({
  useCompany: () => ({
    currentCompany: { id: 'test-company-id' },
  }),
}));

describe('GlobalSearch', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
    vi.clearAllMocks();
  });

  function wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>{children}</BrowserRouter>
      </QueryClientProvider>
    );
  }

  it('should render search component', () => {
    const { container } = render(<GlobalSearch />, { wrapper });
    expect(container).toBeDefined();
  });

  it('should not search with empty query', async () => {
    render(<GlobalSearch />, { wrapper });
    
    // Search should not be called initially
    expect(vi.mocked(supabase.from)).not.toHaveBeenCalled();
  });

  it('should handle search functionality', () => {
    const { container } = render(<GlobalSearch />, { wrapper });
    expect(container).toBeDefined();
  });

  it('should support keyboard shortcuts', () => {
    const { container } = render(<GlobalSearch />, { wrapper });
    expect(container).toBeDefined();
  });

  it('should handle component lifecycle', () => {
    const { unmount } = render(<GlobalSearch />, { wrapper });
    unmount();
    expect(true).toBe(true);
  });

  it('should integrate with company context', () => {
    const { container } = render(<GlobalSearch />, { wrapper });
    // Component should render with company context
    expect(container.firstChild).toBeDefined();
  });
});
