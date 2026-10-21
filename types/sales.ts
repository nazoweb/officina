import type { DeliveryLine, Party } from './ddt';
export interface Sale {
  id: string; status: 'draft' | 'closed' | 'void'; number: number | null; year: number | null; version: number;
  created_at: string; updated_at: string; closed_at: string | null; created_by: string; closed_by: string | null;
  client_id: string | null; customer_name: string; notes: string; payment_method: string;
  client_snapshot: Partial<Party>; emitter_snapshot: Partial<Party>; operator_name: string;
  lines: DeliveryLine[]; total: string; delivery_document_id: string | null;
  cancelled_at: string | null; cancellation_reason: string | null; stock_restored: boolean;
}
export interface ReorderEntry {
  id: string; sale_id: string; product_id?: string | null; code: string; description: string; supplier: string; supplier_code: string;
  quantity: number; unit: string; sold_at: string; sale_number: number; sale_year: number; sale_status: 'closed' | 'void';
}
export interface ReorderPrint { id: string; print_number: number; created_at: string; operator_name: string; lines: ReorderEntry[] }
export type ReorderPrintSummary = Omit<ReorderPrint, "lines">;
export function saleLabel(sale: Pick<Sale, 'number' | 'year'>) { return sale.number ? `Vendita ${sale.number}/${sale.year}` : 'Carrello vendita'; }
export function saleDate(value: string) { return new Intl.DateTimeFormat('it-IT', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Rome' }).format(new Date(value)); }
