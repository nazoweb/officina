export interface CsvRow {
  categoria: string;
  nome_categoria: string;
  codice_produttore: string;
  codice_magazzino: string;
}

/**
 * Export rows to CSV and trigger download
 * Uses semicolon separator for Excel compatibility
 */
export function exportRowsToCsv(rows: CsvRow[]): void {
  if (rows.length === 0) return;

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
  const csvContent = [header, ...dataRows].join("\n");

  // Add BOM for Excel to correctly recognize UTF-8
  const bom = "\uFEFF";
  const blob = new Blob([bom + csvContent], { type: "text/csv;charset=utf-8" });

  // Create download link
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "codici_magazzino_export.csv";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
