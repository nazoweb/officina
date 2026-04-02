import type { CategoryCode } from "@/lib/categories";

export interface EncodeResult {
  categoryCode: CategoryCode;
  categoryName: string;
  producerCode: string;
  stockCode: string;
}

export interface DecodeResult {
  categoryCode: CategoryCode;
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
