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
    onPageChange: vi.fn(),
    onPageSizeChange: vi.fn(),
  };

  it('should render pagination info correctly', () => {
    render(<PaginationControls {...defaultProps} />);
    expect(screen.getByText('Mostrando 1 a 25 de 250 resultados')).toBeInTheDocument();
  });

  it('should disable previous buttons on first page', () => {
    render(<PaginationControls {...defaultProps} />);
    
    const firstPageBtn = screen.getByLabelText('Primera página');
    const prevPageBtn = screen.getByLabelText('Página anterior');
    
    expect(firstPageBtn).toBeDisabled();
    expect(prevPageBtn).toBeDisabled();
  });

  it('should enable next buttons when not on last page', () => {
    render(<PaginationControls {...defaultProps} />);
    
    const nextPageBtn = screen.getByLabelText('Página siguiente');
    const lastPageBtn = screen.getByLabelText('Última página');
    
    expect(nextPageBtn).not.toBeDisabled();
    expect(lastPageBtn).not.toBeDisabled();
  });

  it('should disable next buttons on last page', () => {
    render(<PaginationControls {...defaultProps} currentPage={10} />);
    
    const nextPageBtn = screen.getByLabelText('Página siguiente');
    const lastPageBtn = screen.getByLabelText('Última página');
    
    expect(nextPageBtn).toBeDisabled();
    expect(lastPageBtn).toBeDisabled();
  });

  it('should call onPageChange when clicking navigation buttons', async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();
    
    render(<PaginationControls {...defaultProps} currentPage={5} onPageChange={onPageChange} />);
    
    await user.click(screen.getByLabelText('Primera página'));
    expect(onPageChange).toHaveBeenCalledWith(1);
    
    await user.click(screen.getByLabelText('Página anterior'));
    expect(onPageChange).toHaveBeenCalledWith(4);
    
    await user.click(screen.getByLabelText('Página siguiente'));
    expect(onPageChange).toHaveBeenCalledWith(6);
    
    await user.click(screen.getByLabelText('Última página'));
    expect(onPageChange).toHaveBeenCalledWith(10);
  });

  it('should show correct page info for middle page', () => {
    render(<PaginationControls {...defaultProps} currentPage={5} />);
    expect(screen.getByText('Mostrando 101 a 125 de 250 resultados')).toBeInTheDocument();
    expect(screen.getByText('Página 5 de 10')).toBeInTheDocument();
  });

  it('should handle last page with partial results', () => {
    render(<PaginationControls {...defaultProps} currentPage={10} totalItems={233} />);
    expect(screen.getByText('Mostrando 226 a 233 de 233 resultados')).toBeInTheDocument();
  });

  it('should hide page size selector when showPageSizeSelector is false', () => {
    render(<PaginationControls {...defaultProps} showPageSizeSelector={false} />);
    expect(screen.queryByText('Filas por página:')).not.toBeInTheDocument();
  });

  it('should hide page info when showPageInfo is false', () => {
    render(<PaginationControls {...defaultProps} showPageInfo={false} />);
    expect(screen.queryByText(/Mostrando/)).not.toBeInTheDocument();
  });

  it('should handle empty dataset', () => {
    render(<PaginationControls {...defaultProps} totalItems={0} totalPages={0} />);
    expect(screen.getByText('Mostrando 0 a 0 de 0 resultados')).toBeInTheDocument();
  });
});
