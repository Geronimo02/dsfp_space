import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useServerPagination } from '@/hooks/useServerPagination';

describe('useServerPagination', () => {
  it('should initialize with default values', () => {
    const { result } = renderHook(() => useServerPagination());
    
    expect(result.current.currentPage).toBe(1);
    expect(result.current.pageSize).toBe(50);
    expect(result.current.offset).toBe(0);
    expect(result.current.from).toBe(0);
    expect(result.current.to).toBe(49);
  });

  it('should initialize with custom values', () => {
    const { result } = renderHook(() => 
      useServerPagination({ pageSize: 25, initialPage: 2 })
    );
    
    expect(result.current.currentPage).toBe(2);
    expect(result.current.pageSize).toBe(25);
    expect(result.current.offset).toBe(25);
    expect(result.current.from).toBe(25);
    expect(result.current.to).toBe(49);
  });

  it('should calculate correct range for page 1', () => {
    const { result } = renderHook(() => useServerPagination({ pageSize: 10 }));
    
    expect(result.current.from).toBe(0);
    expect(result.current.to).toBe(9);
  });

  it('should calculate correct range for page 2', () => {
    const { result } = renderHook(() => useServerPagination({ pageSize: 10 }));
    
    act(() => {
      result.current.goToNextPage();
    });
    
    expect(result.current.from).toBe(10);
    expect(result.current.to).toBe(19);
  });

  it('should calculate total pages correctly', () => {
    const { result } = renderHook(() => useServerPagination({ pageSize: 10 }));
    
    expect(result.current.getTotalPages(100)).toBe(10);
    expect(result.current.getTotalPages(95)).toBe(10);
    expect(result.current.getTotalPages(101)).toBe(11);
  });

  it('should handle navigation correctly', () => {
    const { result } = renderHook(() => useServerPagination({ pageSize: 10 }));
    
    expect(result.current.canGoPrevious).toBe(false);
    expect(result.current.canGoNext(100)).toBe(true);
    
    act(() => {
      result.current.goToNextPage();
    });
    
    expect(result.current.currentPage).toBe(2);
    expect(result.current.canGoPrevious).toBe(true);
    
    act(() => {
      result.current.goToPreviousPage();
    });
    
    expect(result.current.currentPage).toBe(1);
  });

  it('should not go below page 1', () => {
    const { result } = renderHook(() => useServerPagination());
    
    act(() => {
      result.current.goToPreviousPage();
      result.current.goToPreviousPage();
    });
    
    expect(result.current.currentPage).toBe(1);
  });

  it('should jump to first and last page', () => {
    const { result } = renderHook(() => useServerPagination({ pageSize: 10 }));
    
    act(() => {
      result.current.goToLastPage(100);
    });
    
    expect(result.current.currentPage).toBe(10);
    
    act(() => {
      result.current.goToFirstPage();
    });
    
    expect(result.current.currentPage).toBe(1);
  });

  it('should reset to page 1 when changing page size', () => {
    const { result } = renderHook(() => useServerPagination({ pageSize: 10 }));
    
    act(() => {
      result.current.goToNextPage();
      result.current.goToNextPage();
    });
    
    expect(result.current.currentPage).toBe(3);
    
    act(() => {
      result.current.setPageSize(25);
    });
    
    expect(result.current.currentPage).toBe(1);
    expect(result.current.pageSize).toBe(25);
  });

  it('should provide correct page info', () => {
    const { result } = renderHook(() => useServerPagination({ pageSize: 10 }));
    
    let info = result.current.getPageInfo(100);
    expect(info).toEqual({ start: 1, end: 10, total: 100 });
    
    act(() => {
      result.current.goToNextPage();
    });
    
    info = result.current.getPageInfo(100);
    expect(info).toEqual({ start: 11, end: 20, total: 100 });
    
    act(() => {
      result.current.goToLastPage(95);
    });
    
    info = result.current.getPageInfo(95);
    expect(info).toEqual({ start: 91, end: 95, total: 95 });
  });

  it('should handle empty dataset', () => {
    const { result } = renderHook(() => useServerPagination());
    
    const info = result.current.getPageInfo(0);
    expect(info).toEqual({ start: 0, end: 0, total: 0 });
    expect(result.current.getTotalPages(0)).toBe(0);
    expect(result.current.canGoNext(0)).toBe(false);
  });
});
