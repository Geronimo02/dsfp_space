import { useState, useMemo } from "react";

interface UseServerPaginationProps {
  pageSize?: number;
  initialPage?: number;
}

interface UseServerPaginationReturn {
  currentPage: number;
  pageSize: number;
  offset: number;
  from: number;
  to: number;
  setCurrentPage: (page: number) => void;
  setPageSize: (size: number) => void;
  goToNextPage: () => void;
  goToPreviousPage: () => void;
  goToFirstPage: () => void;
  goToLastPage: (totalCount: number) => void;
  getTotalPages: (totalCount: number) => number;
  canGoNext: (totalCount: number) => boolean;
  canGoPrevious: boolean;
  getPageInfo: (totalCount: number) => { start: number; end: number; total: number };
}

/**
 * Hook for managing server-side pagination with Supabase .range()
 * 
 * @example
 * ```tsx
 * const pagination = useServerPagination({ pageSize: 50 });
 * 
 * const { data, count } = useQuery({
 *   queryKey: ["products", pagination.currentPage],
 *   queryFn: async () => {
 *     const { data, error, count } = await supabase
 *       .from("products")
 *       .select("*", { count: "exact" })
 *       .range(pagination.from, pagination.to);
 *     if (error) throw error;
 *     return { data, count };
 *   }
 * });
 * 
 * <div>
 *   <Button 
 *     onClick={pagination.goToPreviousPage} 
 *     disabled={!pagination.canGoPrevious}
 *   >
 *     Previous
 *   </Button>
 *   <span>Page {pagination.currentPage} of {pagination.getTotalPages(count)}</span>
 *   <Button 
 *     onClick={pagination.goToNextPage} 
 *     disabled={!pagination.canGoNext(count)}
 *   >
 *     Next
 *   </Button>
 * </div>
 * ```
 */
export function useServerPagination({
  pageSize = 50,
  initialPage = 1,
}: UseServerPaginationProps = {}): UseServerPaginationReturn {
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [currentPageSize, setCurrentPageSize] = useState(pageSize);

  // Supabase uses 0-based indexing for .range()
  const offset = useMemo(() => {
    return (currentPage - 1) * currentPageSize;
  }, [currentPage, currentPageSize]);

  // For Supabase .range(from, to)
  const from = offset;
  const to = offset + currentPageSize - 1;

  const getTotalPages = (totalCount: number) => {
    return Math.ceil(totalCount / currentPageSize);
  };

  const canGoNext = (totalCount: number) => {
    return currentPage < getTotalPages(totalCount);
  };

  const canGoPrevious = currentPage > 1;

  const goToNextPage = () => {
    setCurrentPage((prev) => prev + 1);
  };

  const goToPreviousPage = () => {
    setCurrentPage((prev) => Math.max(1, prev - 1));
  };

  const goToFirstPage = () => {
    setCurrentPage(1);
  };

  const goToLastPage = (totalCount: number) => {
    setCurrentPage(getTotalPages(totalCount));
  };

  const handlePageSizeChange = (newSize: number) => {
    setCurrentPageSize(newSize);
    setCurrentPage(1); // Reset to first page when changing page size
  };

  const getPageInfo = (totalCount: number) => {
    const start = totalCount > 0 ? offset + 1 : 0;
    const end = Math.min(offset + currentPageSize, totalCount);
    return { start, end, total: totalCount };
  };

  return {
    currentPage,
    pageSize: currentPageSize,
    offset,
    from,
    to,
    setCurrentPage,
    setPageSize: handlePageSizeChange,
    goToNextPage,
    goToPreviousPage,
    goToFirstPage,
    goToLastPage,
    getTotalPages,
    canGoNext,
    canGoPrevious,
    getPageInfo,
  };
}
