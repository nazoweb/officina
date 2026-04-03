export interface EncodeResult {
  categoryCode: string;
  categoryName: string;
  producerCode: string;
  stockCode: string;
}

export interface DecodeResult {
  categoryCode: string;
  categoryName: string;
  producerCode: string;
  stockCode?: string; // Added for table display
}

export interface BulkError {
  input: string;
  error: string;
}

export interface CsvRow {
  categoria: string;
  nome_categoria: string;
  codice_produttore: string;
  codice_magazzino: string;
}
