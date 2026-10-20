/**
 * Defends against CSV Formula Injection / CSV Injection / Formula Execution (CWE-1236).
 * Any cell beginning with '=', '+', '-', '@', '\t', or '\r' is prefixed with a single quote (').
 * Cells containing commas, quotes, or newlines are wrapped in double quotes with internal quotes escaped.
 */
export function escapeCsvCell(val: unknown): string {
  if (val === null || val === undefined) {
    return '';
  }

  let str = String(val);

  // Strip or neutralize formula triggers
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }

  // If cell contains commas, quotes, or line breaks, enclose in quotes
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }

  return str;
}

export function formatCsvRow(cells: unknown[]): string {
  return cells.map(escapeCsvCell).join(',');
}

export function generateCsv(headers: string[], rows: unknown[][]): string {
  const headerRow = headers.map(escapeCsvCell).join(',');
  const dataRows = rows.map((row) => formatCsvRow(row));
  return [headerRow, ...dataRows].join('\r\n');
}
