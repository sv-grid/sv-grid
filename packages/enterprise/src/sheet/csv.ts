/**
 * A sheet as CSV, the way Excel's Save As CSV writes one: what the cells
 * SHOW, so a formula goes out as its value and a formatted number as its
 * text; a field with a comma, a quote or a line break in quotes, a quote
 * doubled; CRLF between rows; trailing empty cells kept so every row has
 * the sheet's width.
 */
export function csvText(rows: ReadonlyArray<ReadonlyArray<string>>, separator = ','): string {
  const width = rows.reduce((max, row) => Math.max(max, row.length), 0)
  const field = (text: string): string =>
    /[",\r\n]/.test(text) || text.includes(separator) ? `"${text.replace(/"/g, '""')}"` : text
  return rows
    .map((row) => Array.from({ length: width }, (_, i) => field(row[i] ?? '')).join(separator))
    .join('\r\n')
}
