/**
 * Query helpers for consistent pagination and limits
 * Prevents DoS attacks and improves performance
 */

import { SupabaseClient } from '@supabase/supabase-js';

/**
 * Default limits for different types of queries
 */
export const QUERY_LIMITS = {
  DEFAULT: 100,
  LIST: 500,
  LARGE_LIST: 1000,
  SEARCH: 50,
  RECENT: 20,
  SINGLE: 1,
} as const;

/**
 * Apply consistent limit to a Supabase query
 * @param query - Supabase query builder
 * @param limit - Maximum number of records (default: 100)
 * @returns Query with limit applied
 */
export function withLimit<T>(
  query: T,
  limit: number = QUERY_LIMITS.DEFAULT
): T {
  return (query as any).limit(limit);
}

/**
 * Apply pagination to a query
 * @param query - Supabase query builder
 * @param page - Page number (1-indexed)
 * @param pageSize - Items per page
 * @returns Query with pagination applied
 */
export function withPagination<T>(
  query: T,
  page: number = 1,
  pageSize: number = QUERY_LIMITS.DEFAULT
): T {
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  return (query as any).range(from, to);
}

/**
 * Apply both limit and ordering to a query
 * @param query - Supabase query builder
 * @param options - Limit and order options
 * @returns Query with limit and order applied
 */
export function withLimitAndOrder<T>(
  query: T,
  options: {
    limit?: number;
    orderBy?: string;
    ascending?: boolean;
  } = {}
): T {
  const {
    limit = QUERY_LIMITS.DEFAULT,
    orderBy = 'created_at',
    ascending = false,
  } = options;

  let result = (query as any).limit(limit);
  if (orderBy) {
    result = result.order(orderBy, { ascending });
  }
  return result;
}

/**
 * Sanitize search query to prevent SQL injection
 * @param query - User input search query
 * @returns Sanitized query or null
 */
export function sanitizeSearchQuery(query: string | undefined | null): string | null {
  if (!query) return null;
  
  // Remove special characters that could be used for SQL injection
  const sanitized = query
    .trim()
    .replace(/[;'"\\]/g, '') // Remove SQL special chars
    .slice(0, 100); // Limit length
  
  return sanitized || null;
}

/**
 * Build a safe search filter for Supabase
 * @param column - Column to search in
 * @param searchTerm - Search term
 * @returns Object with filter configuration
 */
export function buildSearchFilter(
  column: string,
  searchTerm: string | undefined | null
): { column: string; pattern: string } | null {
  const sanitized = sanitizeSearchQuery(searchTerm);
  if (!sanitized) return null;
  
  return {
    column,
    pattern: `%${sanitized}%`,
  };
}

/**
 * Apply multiple filters to a query safely
 * @param query - Supabase query builder
 * @param filters - Object with column-value pairs
 * @returns Query with filters applied
 */
export function withFilters<T>(
  query: T,
  filters: Record<string, any>
): T {
  let result = query;
  
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      result = (result as any).eq(key, value);
    }
  });
  
  return result;
}

/**
 * Wrapper for safe query execution with automatic limits
 * @param client - Supabase client
 * @param table - Table name
 * @param options - Query options
 * @returns Promise with query result
 */
export async function safeQuery<T = any>(
  client: SupabaseClient,
  table: string,
  options: {
    select?: string;
    filters?: Record<string, any>;
    limit?: number;
    orderBy?: string;
    ascending?: boolean;
  } = {}
): Promise<{ data: T[] | null; error: any }> {
  const {
    select = '*',
    filters = {},
    limit = QUERY_LIMITS.DEFAULT,
    orderBy = 'created_at',
    ascending = false,
  } = options;

  let query = client.from(table).select(select);
  
  // Apply filters
  query = withFilters(query, filters);
  
  // Apply limit and order
  query = query.limit(limit).order(orderBy, { ascending });
  
  const result = await query;
  return result as { data: T[] | null; error: any };
}

/**
 * Check if a query result is within safe limits
 * @param count - Number of records returned
 * @param limit - Expected limit
 * @returns Warning message if limit is reached
 */
export function checkQueryLimit(
  count: number,
  limit: number
): string | null {
  if (count >= limit) {
    return `Se alcanzó el límite de ${limit} registros. Puede haber más resultados disponibles. Considere refinar su búsqueda.`;
  }
  return null;
}
