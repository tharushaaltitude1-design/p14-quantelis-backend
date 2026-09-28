import { useEffect, useMemo, useState } from 'react';

type TableState<T> = {
  rows: T[];
  /** Current search text. */
  search: string;
  /**
   * Case-insensitive predicate combining the search text with the caller's active filters.
   * Receives an already-lowercased needle (empty when the search box is blank) and must
   * therefore be applied even for an empty needle.
   */
  matches: (row: T, needle: string) => boolean;
  /** Optional comparator; omit to keep the source order. */
  sort?: (a: T, b: T) => number;
  pageSize: number;
  /** Values that should send the user back to page 1 when they change. */
  resetKey?: unknown;
};

export type TableResult<T> = {
  /** Rows matching the search text, before pagination. */
  matched: T[];
  /** Rows for the current page. */
  pageRows: T[];
  page: number;
  pageCount: number;
  total: number;
  setPage: (page: number) => void;
};

/**
 * Single place where search + sort + pagination compose, so no page re-implements them.
 * Filtering is expressed by the caller's `matches` predicate, which keeps filters and
 * search working through exactly one pipeline.
 */
export function useTableState<T>({ rows, search, matches, sort, pageSize, resetKey }: TableState<T>): TableResult<T> {
  const [page, setPage] = useState(1);

  const matched = useMemo(() => {
    const needle = search.trim().toLowerCase();
    // `matches` is always applied, even with an empty needle: callers fold their filter
    // conditions into this predicate, so skipping it would make every filter a no-op
    // until the user typed something. An empty needle is a no-op for text matching.
    const filtered = rows.filter((row) => matches(row, needle));
    return sort ? [...filtered].sort(sort) : filtered;
  }, [rows, search, matches, sort]);

  const pageCount = Math.max(1, Math.ceil(matched.length / pageSize));

  // Any change to the query shape returns the user to the first page.
  useEffect(() => {
    setPage(1);
  }, [search, pageSize, resetKey]);

  // Guard against the result set shrinking under the current page.
  useEffect(() => {
    setPage((current) => Math.min(current, pageCount));
  }, [pageCount]);

  const pageRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return matched.slice(start, start + pageSize);
  }, [matched, page, pageSize]);

  return { matched, pageRows, page, pageCount, total: matched.length, setPage };
}

/** Builds a case-insensitive matcher across several fields of a row. */
export function textMatcher<T>(fields: (row: T) => Array<string | number | undefined | null>): (row: T, needle: string) => boolean {
  return (row, needle) => {
    const haystack = fields(row).filter((value) => value !== null && value !== undefined).join(' ').toLowerCase();
    return haystack.includes(needle);
  };
}
