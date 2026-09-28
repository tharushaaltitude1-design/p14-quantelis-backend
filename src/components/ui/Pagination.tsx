import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Select } from './Select';

type PaginationProps = {
  page: number;
  pageCount: number;
  total: number;
  /** Plural noun for the row type, e.g. "datasets". */
  noun: string;
  pageSize: number;
  pageSizes?: number[];
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  /** Extra element rendered on the left, e.g. an active-filter summary. */
  children?: React.ReactNode;
};

export function Pagination({ page, pageCount, total, noun, pageSize, pageSizes, onPageChange, onPageSizeChange, children }: PaginationProps) {
  const first = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);
  return (
    <div className="pagination">
      <span>
        {total === 0 ? (
          <>No {noun} to show</>
        ) : (
          <>
            Showing <b>{first}</b>–<b>{last}</b> of <b>{total}</b> {noun}
          </>
        )}
      </span>
      <div className="pagination-controls">
        {children}
        {onPageSizeChange && pageSizes && (
          <label className="page-size">
            <span>Per page</span>
            <Select value={String(pageSize)} onChange={(value) => onPageSizeChange(Number(value))} options={pageSizes.map(String)} label="Rows per page" className="compact-select" />
          </label>
        )}
        <button type="button" className="page-number" onClick={() => onPageChange(page - 1)} disabled={page <= 1} aria-label="Previous page">
          <ChevronLeft size={14} />
        </button>
        <span className="page-position" aria-live="polite">
          Page {Math.min(page, Math.max(pageCount, 1))} of {Math.max(pageCount, 1)}
        </span>
        <button type="button" className="page-number" onClick={() => onPageChange(page + 1)} disabled={page >= pageCount} aria-label="Next page">
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}
