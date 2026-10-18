/** Quotes CSV fields and neutralizes spreadsheet formula prefixes in untrusted values. */
export function escapeCsvCell(value: unknown): string {
  const raw = String(value ?? "");
  const safe = /^[\u0000-\u0020]*[=+\-@]/.test(raw) ? `'${raw}` : raw;
  return `"${safe.replace(/"/g, '""')}"`;
}

export function serializeCsvRows(rows: unknown[][]): string {
  return `\uFEFF${rows.map(row => row.map(escapeCsvCell).join(",")).join("\r\n")}`;
}
