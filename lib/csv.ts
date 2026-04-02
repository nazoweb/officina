import { formatTimestamp } from "./storage";

export interface CsvRow {
  categoria: string;
  nome_categoria: string;
  codice_produttore: string;
  codice_magazzino: string;
}

/**
 * Generate CSV content from rows
 * Uses semicolon separator for Excel compatibility
 * Includes UTF-8 BOM
 */
export function generateCsvContent(rows: CsvRow[]): string {
  if (rows.length === 0) return "";

  // Header row
  const header = "categoria;nome_categoria;codice_produttore;codice_magazzino";

  // Data rows - escape values that might contain semicolons or quotes
  const dataRows = rows.map((row) => {
    const escapeField = (value: string): string => {
      // If value contains semicolon, newline, or quotes, wrap in quotes and escape internal quotes
      if (value.includes(";") || value.includes("\n") || value.includes('"')) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    };

    return [
      escapeField(row.categoria),
      escapeField(row.nome_categoria),
      escapeField(row.codice_produttore),
      escapeField(row.codice_magazzino),
    ].join(";");
  });

  // Combine header and data
  return [header, ...dataRows].join("\n");
}

/**
 * Export rows to CSV and trigger download
 * Filename includes timestamp: prefix_YYYY-MM-DD_HH-mm.csv
 */
export function exportRowsToCsv(rows: CsvRow[], filenamePrefix: string = "codici_magazzino"): void {
  if (rows.length === 0) return;

  const csvContent = generateCsvContent(rows);

  // Add BOM for Excel to correctly recognize UTF-8
  const bom = "\uFEFF";
  const blob = new Blob([bom + csvContent], { type: "text/csv;charset=utf-8" });

  // Create filename with timestamp
  const timestamp = formatTimestamp(new Date());
  const filename = `${filenamePrefix}_${timestamp}.csv`;

  // Create download link
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Copy options for results
 */
export type CopyFormat = "full" | "codes-only" | "excel-column";

export function formatResultsForCopy(
  rows: CsvRow[],
  format: CopyFormat
): string {
  switch (format) {
    case "codes-only":
      return rows.map((r) => r.codice_magazzino).join("\n");
    case "excel-column":
      return rows.map((r) => r.codice_magazzino).join("\n");
    case "full":
    default:
      return rows
        .map(
          (r) =>
            `${r.categoria}\t${r.nome_categoria}\t${r.codice_produttore}\t${r.codice_magazzino}`
        )
        .join("\n");
  }
}
