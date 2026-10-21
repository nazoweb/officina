"use client";
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { tracked } from '@/lib/inventory/activity';
import { UserFacingError } from '@/lib/user-errors';
import type { Sale, ReorderEntry, ReorderPrint, ReorderPrintSummary } from '@/types/sales';

function fail(error: unknown) { if (error) throw error; }
async function command<T>(action: string, id: string | null = null, version: number | null = null, payload: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await createSupabaseBrowserClient().rpc('sales_command', { p_action: action, p_id: id, p_version: version, p_payload: payload });
  fail(error); return data as T;
}
export const openSale = tracked('openSale', () => command<Sale>('open'));
export const editSale = tracked('editSale', (sale: Sale, draft: Pick<Sale,'client_id'|'customer_name'|'notes'|'payment_method'>) => command<Sale>('edit', sale.id, sale.version, draft));
export const addSaleProduct = tracked('addSaleProduct', (saleId: string, productId: string, operationId: string) => command<Sale>('add', saleId, null, { product_id: productId, operation_id: operationId }));
export const updateSaleLine = tracked('updateSaleLine', (sale: Sale, index: number, quantity: string, unit_price: string, discount: string) => command<Sale>('line', sale.id, sale.version, { index, quantity, unit_price, discount }));
export const discardSale = tracked('discardSale', (sale: Sale) => command('discard', sale.id, sale.version));
export const closeSale = tracked('closeSale', (sale: Sale, issueDdt: boolean) => command<Sale>('close', sale.id, sale.version, { issue_ddt: issueDdt }));
export const voidSale = tracked('voidSale', (sale: Sale, reason: string, restoreStock: boolean) => command<Sale>('void', sale.id, sale.version, { reason, restore_stock: restoreStock }));
export const createSaleDdt = tracked('createSaleDdt', (sale: Sale) => command<Sale>('document', sale.id, sale.version));
export const snapshotReorder = tracked('snapshotReorder', (requestId: string) => command<ReorderPrint>('snapshot', requestId));
export const removeReorder = tracked('removeReorder', (ids: string[]) => command<{removed:number}>('remove_reorder', null, null, { ids }));
export const getSale = tracked('getSale', async (id: string): Promise<Sale> => {
  const { data, error } = await createSupabaseBrowserClient().from('sales_view').select('*').eq('id',id).single(); fail(error); return data as Sale;
});
export const listSales = tracked('listSales', async (filters: { from?: string; to?: string; query?: string } = {}): Promise<Sale[]> => {
  if (filters.from && filters.to && filters.from > filters.to) throw new UserFacingError('La data iniziale deve precedere la data finale.');
  const result: Sale[] = [];
  for (let offset = 0;;offset += 500) {
    let request = createSupabaseBrowserClient().from('sales_view').select('*').neq('status','draft').order('closed_at',{ascending:false}).order('id').range(offset,offset+499);
    // Rome local days include both CEST/CET offsets; filter the formatted day below for exact boundaries.
    if (filters.from) request = request.gte('closed_at', `${filters.from}T00:00:00+02:00`);
    if (filters.to) request = request.lte('closed_at', `${filters.to}T23:59:59.999999+01:00`);
    const { data, error } = await request; fail(error); result.push(...data as Sale[]);
    if ((data?.length ?? 0) < 500) break;
  }
  const day = new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Rome',year:'numeric',month:'2-digit',day:'2-digit'});
  const query = filters.query?.trim().toUpperCase() ?? '';
  return result.filter(s => {
    const date = day.format(new Date(s.closed_at!));
    return (!filters.from || date >= filters.from) && (!filters.to || date <= filters.to)
      && (!query || [`${s.number}/${s.year}`,s.customer_name,s.operator_name,...s.lines.map(l => `${l.code} ${l.description}`)].join(' ').toUpperCase().includes(query));
  });
});
export const listReorder = tracked('listReorder', async (): Promise<ReorderEntry[]> => {
  const result: ReorderEntry[] = [];
  for (let offset=0;;offset+=500) {
    const {data,error}=await createSupabaseBrowserClient().from('reorder_entries_view').select('*').is('removed_at',null).order('sold_at').order('id').range(offset,offset+499);
    fail(error); result.push(...data as ReorderEntry[]); if((data?.length ?? 0)<500)return result;
  }
});
export const listReorderPrints = tracked('listReorderPrints', async (): Promise<ReorderPrintSummary[]> => {
  const result: ReorderPrintSummary[]=[];
  for(let offset=0;;offset+=500) {
    const {data,error}=await createSupabaseBrowserClient().from('reorder_prints').select('id,print_number,created_at,operator_name').order('created_at',{ascending:false}).order('id').range(offset,offset+499);
    fail(error); result.push(...data as ReorderPrintSummary[]); if((data?.length ?? 0)<500)return result;
  }
});
export const getReorderPrint = tracked('getReorderPrint', async (id:string):Promise<ReorderPrint> => {
  const {data,error}=await createSupabaseBrowserClient().from('reorder_prints').select('*').eq('id',id).single(); fail(error); return data as ReorderPrint;
});
