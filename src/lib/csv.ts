type CsvValue = string | number | boolean | null | undefined;

/**
 * Characters that make a spreadsheet treat a cell as a formula rather than text.
 *
 * A cell beginning with `=`, `+`, `-` or `@` is executed by Excel, LibreOffice, Google Sheets and
 * Numbers when the exported file is opened. Because several export paths include
 * user-controlled values (dataset names, activity titles and references), a name like
 * `=cmd|'/c calc'!A1` would otherwise become a live payload on the machine of whoever opens the
 * download. Tab and CR are included because they are stripped by some parsers, which can expose a
 * leading formula character that looked harmless in the original string.
 */
const FORMULA_TRIGGERS = /^[=+\-@\t\r]/;

/**
 * Neutralises a cell that a spreadsheet would evaluate.
 *
 * A single leading apostrophe is prepended, which every spreadsheet treats as a "this is literal
 * text" marker, and any apostrophe already in the value is doubled so the quoting stays valid.
 * Prefixing rather than wrapping is deliberate: it is the conventional defence, and it leaves the
 * readable value intact for anything that inspects the file as text.
 */
function neutraliseFormula(text: string): string {
  return `'${text.replace(/'/g, "''")}`;
}

function escapeCell(value: CsvValue): string {
  const text = value === null || value === undefined ? '' : String(value);

  // Only *text* can be a formula. A real number such as -42.5 starts with a dash but evaluates
  // as a number, so neutralising it would turn legitimate figures into text and break the export
  // for whoever opens it. Only a string reaching a spreadsheet is a potential payload.
  const isText = typeof value === 'string';

  // Pass 1 (security): a guarded cell is always quoted, never left bare. An unquoted
  // `'=1+1` relies on every parser honouring the apostrophe convention; quoting it means the
  // literal-text marker survives even a parser that would otherwise strip it.
  if (isText && FORMULA_TRIGGERS.test(text)) {
    return `"${neutraliseFormula(text).replace(/"/g, '""')}"`;
  }

  // Pass 2 (CSV syntax): quote when the cell contains a comma, quote or newline, and double any
  // embedded quote.
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Builds a CSV string from a header row and body rows. */
export function toCsv(headers: string[], rows: CsvValue[][]): string {
  return [headers, ...rows].map((row) => row.map(escapeCell).join(',')).join('\n');
}

/** Triggers a client-side file download. Returns false when there is no DOM (e.g. tests). */
export function downloadCsv(filename: string, headers: string[], rows: CsvValue[][]): boolean {
  if (typeof document === 'undefined' || typeof URL.createObjectURL !== 'function') return false;
  const blob = new Blob([`\uFEFF${toCsv(headers, rows)}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  return true;
}

/** Copies text to the clipboard, falling back to a hidden textarea when the API is absent. */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through to the legacy path below */
  }
  try {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand('copy');
    area.remove();
    return ok;
  } catch {
    return false;
  }
}
