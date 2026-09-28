import { describe, expect, it } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTableState, textMatcher } from '../useTableState';

type Row = { id: string; name: string; status: string; score: number };

const ROWS: Row[] = [
  { id: '1', name: 'Alpha', status: 'Active', score: 10 },
  { id: '2', name: 'Beta', status: 'Draft', score: 30 },
  { id: '3', name: 'Gamma', status: 'Active', score: 20 },
  { id: '4', name: 'Delta', status: 'Archived', score: 40 },
  { id: '5', name: 'Epsilon', status: 'Draft', score: 50 },
];

const matches = textMatcher<Row>((row) => [row.name, row.status]);

describe('textMatcher', () => {
  it('matches across several fields', () => {
    expect(matches(ROWS[0], 'alpha')).toBe(true);
    expect(matches(ROWS[0], 'active')).toBe(true);
    expect(matches(ROWS[0], 'nope')).toBe(false);
  });

  it('receives an already-lowercased needle, which useTableState guarantees', () => {
    // A raw uppercase needle is the caller's job to normalise, so assert useTableState
    // does it rather than that the matcher does.
    const { result } = renderHook(() => useTableState({ rows: ROWS, search: 'ACTIVE', matches, pageSize: 5 }));
    expect(result.current.total).toBe(2);
  });
});

describe('useTableState', () => {
  it('returns every row when the search is empty', () => {
    const { result } = renderHook(() => useTableState({ rows: ROWS, search: '', matches, pageSize: 2 }));
    expect(result.current.total).toBe(5);
    expect(result.current.pageCount).toBe(3);
    expect(result.current.pageRows).toHaveLength(2);
  });

  it('filters rows and recomputes the page count', () => {
    const { result } = renderHook(() => useTableState({ rows: ROWS, search: 'active', matches, pageSize: 2 }));
    expect(result.current.total).toBe(2);
    expect(result.current.pageRows.map((r) => r.name)).toEqual(['Alpha', 'Gamma']);
  });

  it('paginates without dropping or repeating rows', () => {
    const { result } = renderHook(() => useTableState({ rows: ROWS, search: '', matches, pageSize: 2 }));
    const seen: string[] = [];
    for (let page = 1; page <= result.current.pageCount; page += 1) {
      act(() => result.current.setPage(page));
      seen.push(...result.current.pageRows.map((r) => r.id));
    }
    expect(seen).toEqual(['1', '2', '3', '4', '5']);
  });

  it('sorts through the caller comparator', () => {
    const { result } = renderHook(() => useTableState({ rows: ROWS, search: '', matches, pageSize: 5, sort: (a, b) => b.score - a.score }));
    expect(result.current.pageRows.map((r) => r.name)).toEqual(['Epsilon', 'Delta', 'Beta', 'Gamma', 'Alpha']);
  });

  it('returns to page 1 when the search changes', () => {
    const { result, rerender } = renderHook(({ search }: { search: string }) => useTableState({ rows: ROWS, search, matches, pageSize: 2 }), {
      initialProps: { search: '' },
    });

    act(() => result.current.setPage(3));
    expect(result.current.page).toBe(3);

    rerender({ search: 'a' });
    expect(result.current.page).toBe(1);
  });

  it('returns to page 1 when resetKey changes', () => {
    const { result, rerender } = renderHook(
      ({ filter }: { filter: string }) => useTableState({ rows: ROWS, search: '', matches, pageSize: 2, resetKey: filter }),
      { initialProps: { filter: 'all' } },
    );

    act(() => result.current.setPage(2));
    expect(result.current.page).toBe(2);

    rerender({ filter: 'active' });
    expect(result.current.page).toBe(1);
  });

  it('clamps the page when the result set shrinks', () => {
    const { result, rerender } = renderHook(({ search }: { search: string }) => useTableState({ rows: ROWS, search, matches, pageSize: 2 }), {
      initialProps: { search: '' },
    });

    act(() => result.current.setPage(3));
    expect(result.current.page).toBe(3);

    rerender({ search: 'gamma' });
    expect(result.current.page).toBe(1);
    expect(result.current.pageRows.map((r) => r.name)).toEqual(['Gamma']);
  });

  it('applies the caller filter even when the search box is empty', () => {
    // Regression: `matches` used to be skipped for an empty needle, which turned every
    // dropdown filter into a no-op until the user typed a search term.
    const filtered = (row: Row, needle: string) => matches(row, needle) && row.status === 'Active';
    const { result } = renderHook(() => useTableState({ rows: ROWS, search: '', matches: filtered, pageSize: 5 }));
    expect(result.current.total).toBe(2);
    expect(result.current.pageRows.map((r) => r.name)).toEqual(['Alpha', 'Gamma']);
  });

  it('combines the filter and the search term', () => {
    const filtered = (row: Row, needle: string) => matches(row, needle) && row.status === 'Draft';
    const { result } = renderHook(() => useTableState({ rows: ROWS, search: 'beta', matches: filtered, pageSize: 5 }));
    expect(result.current.pageRows.map((r) => r.name)).toEqual(['Beta']);

    const noHit = renderHook(() => useTableState({ rows: ROWS, search: 'alpha', matches: filtered, pageSize: 5 }));
    expect(noHit.result.current.total).toBe(0);
  });

  it('reports zero results for a search that matches nothing', () => {
    const { result } = renderHook(() => useTableState({ rows: ROWS, search: 'zzzzz', matches, pageSize: 2 }));
    expect(result.current.total).toBe(0);
    expect(result.current.pageRows).toEqual([]);
    expect(result.current.pageCount).toBe(1);
  });
});
