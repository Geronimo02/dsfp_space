import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PaginationControls } from '@/components/ui/pagination-controls';

describe('PaginationControls', () => {
  const defaultProps = {
    currentPage: 1,
    totalPages: 10,
    pageSize: 25,
    totalItems: 250,
    startIndex: 1,
    endIndex: 25,
    canGoNext: true,
    canGoPrevious: false,
    onPageChange: vi.fn(),
    onPageSizeChange: vi.fn(),
    onNextPage: vi.fn(),
    onPreviousPage: vi.fn(),
    onFirstPage: vi.fn(),
    onLastPage: vi.fn(),
  };

  it('should render pagination info correctly', () => {
    render(<PaginationControls {...defaultProps} />);
    expect(screen.getByText('Mostrando')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('25')).toBeInTheDocument();
    expect(screen.getByText('250')).toBeInTheDocument();
  });

  it('should disable previous buttons on first page', () => {
    render(<PaginationControls {...defaultProps} />);
    
    const buttons = screen.getAllByRole('button');
    // First two buttons are for first/previous page navigation
    expect(buttons[0]).toBeDisabled(); // First page button
    expect(buttons[1]).toBeDisabled(); // Previous page button
  });

  it('should enable next buttons when not on last page', () => {
    render(<PaginationControls {...defaultProps} />);
    
    const buttons = screen.getAllByRole('button');
    // Last two buttons are for next/last page navigation
    expect(buttons[buttons.length - 2]).not.toBeDisabled(); // Next page button
    expect(buttons[buttons.length - 1]).not.toBeDisabled(); // Last page button
  });

  it('should disable next buttons on last page', () => {
    render(<PaginationControls {...defaultProps} currentPage={10} canGoNext={false} canGoPrevious={true} />);
    
    const buttons = screen.getAllByRole('button');
    // Last two buttons should be disabled
    expect(buttons[buttons.length - 2]).toBeDisabled(); // Next page button
    expect(buttons[buttons.length - 1]).toBeDisabled(); // Last page button
  });

  it('should call navigation handlers when clicking buttons', async () => {
    const user = userEvent.setup();
    const onFirstPage = vi.fn();
    const onPreviousPage = vi.fn();
    const onNextPage = vi.fn();
    const onLastPage = vi.fn();
    
    render(<PaginationControls 
      {...defaultProps} 
      currentPage={5}
      canGoPrevious={true}
      canGoNext={true}
      onFirstPage={onFirstPage}
      onPreviousPage={onPreviousPage}
      onNextPage={onNextPage}
      onLastPage={onLastPage}
    />);
    
    const buttons = screen.getAllByRole('button');
    
    await user.click(buttons[0]); // First page
    expect(onFirstPage).toHaveBeenCalled();
    
    await user.click(buttons[1]); // Previous page
    expect(onPreviousPage).toHaveBeenCalled();
    
    await user.click(buttons[buttons.length - 2]); // Next page
    expect(onNextPage).toHaveBeenCalled();
    
    await user.click(buttons[buttons.length - 1]); // Last page
    expect(onLastPage).toHaveBeenCalled();
  });

  it('should show correct page info for middle page', () => {
    render(<PaginationControls {...defaultProps} currentPage={5} startIndex={101} endIndex={125} />);
    expect(screen.getByText('101')).toBeInTheDocument();
    expect(screen.getByText('125')).toBeInTheDocument();
    expect(screen.getByText('Página 5 de 10')).toBeInTheDocument();
  });

  it('should handle last page with partial results', () => {
    render(<PaginationControls {...defaultProps} currentPage={10} totalItems={233} startIndex={226} endIndex={233} />);
    expect(screen.getByText('226')).toBeInTheDocument();
    expect(screen.getByText('233')).toBeInTheDocument();
  });

  it('should not render when totalItems is 0', () => {
    const { container } = render(<PaginationControls {...defaultProps} totalItems={0} />);
    expect(container.firstChild).toBeNull();
  });

  it('should render page size selector', () => {
    render(<PaginationControls {...defaultProps} />);
    expect(screen.getByText('Filas:')).toBeInTheDocument();
  });
});

