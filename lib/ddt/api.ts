"use client";
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { tracked } from '@/lib/inventory/activity';
import { UserFacingError } from '@/lib/user-errors';
import type { BusinessClient, DeliverySettings, DeliveryDocument, DeliveryDraft } from '@/types/ddt';
const fail = (error: unknown) => { if (error) throw error; };
export const listClients = tracked('listClients', async (): Promise<BusinessClient[]> => {
 const result: BusinessClient[] = []; const client = createSupabaseBrowserClient();
 for(let offset=0;;offset+=500) { const {data,error}=await client.from('business_clients').select('*').order('name').range(offset,offset+499); fail(error); result.push(...data as BusinessClient[]); if((data?.length||0)<500)return result; }
});
export const saveClient = tracked('saveClient', async (draft: Omit<BusinessClient,'id'|'updated_at'>, previous?: BusinessClient) => {
 const client=createSupabaseBrowserClient(); const {id:_id,updated_at:_updated,...fields}=draft as BusinessClient; const values={...fields,name:draft.name.trim(),vat_number:draft.vat_number.replace(/\s/g,'').toUpperCase(),tax_code:draft.tax_code.replace(/\s/g,'').toUpperCase()};
 const {data,error}=previous ? await client.from('business_clients').update(values).eq('id',previous.id).eq('updated_at',previous.updated_at).select('id').single() : await client.from('business_clients').insert(values).select('id').single(); if(error?.code==="23505"){const friendly=new UserFacingError("Questa partita IVA o questo codice fiscale sono già presenti. Cerca l’azienda esistente e modifica la sua scheda.");Object.assign(friendly,{code:error.code,cause:error});throw friendly;} fail(error); return data?.id as string;
});
export const deleteClient = tracked('deleteClient', async (client: BusinessClient) => { const {error}=await createSupabaseBrowserClient().from('business_clients').delete().eq('id',client.id).eq('updated_at',client.updated_at).select('id').single(); fail(error); });
export const getDeliverySettings = tracked('getDeliverySettings', async (): Promise<DeliverySettings> => { const {data,error}=await createSupabaseBrowserClient().from('delivery_settings').select('*').eq('id',true).single(); fail(error); return data as DeliverySettings; });
export const saveDeliverySettings = tracked('saveDeliverySettings', async (draft: DeliverySettings) => { const {id,updated_at,...values}=draft; const {error}=await createSupabaseBrowserClient().from('delivery_settings').update(values).eq('id',id).eq('updated_at',updated_at).select('id').single(); fail(error); });
export const listDocuments = tracked('listDocuments', async (filters: { client?: string; from?: string; to?: string; number?: string } = {}): Promise<DeliveryDocument[]> => {
 const result: DeliveryDocument[]=[];
 if(filters.from && filters.to && filters.from>filters.to) throw new UserFacingError('La data iniziale deve precedere la data finale.');
 if(filters.number && !/^\d+$/.test(filters.number)) throw new UserFacingError('Inserisci solo il numero del documento, senza lettere o anno.');
 for(let offset=0;;offset+=500) { let query=createSupabaseBrowserClient().from('delivery_documents_view').select('*').order('document_date',{ascending:false}).order('created_at',{ascending:false}).range(offset,offset+499); if(filters.client)query=query.eq('client_id',filters.client); if(filters.from)query=query.gte('document_date',filters.from); if(filters.to)query=query.lte('document_date',filters.to); if(filters.number)query=query.eq('number',Number(filters.number)); const {data,error}=await query; fail(error);result.push(...data as DeliveryDocument[]);if((data?.length||0)<500)return result; }
});
export const getDocument = tracked('getDocument', async (id: string): Promise<DeliveryDocument> => { const {data,error}=await createSupabaseBrowserClient().from('delivery_documents_view').select('*').eq('id',id).single();fail(error);return data as DeliveryDocument; });
export const saveDocument = tracked('saveDocument', async (id: string,draft: DeliveryDraft,version: number | null) => { const {error}=await createSupabaseBrowserClient().rpc('save_delivery_document',{p_id:id,p_draft:draft,p_expected_version:version});fail(error);return id; });
export const issueDocument = tracked('issueDocument', async (document: DeliveryDocument) => { const {error}=await createSupabaseBrowserClient().rpc('issue_delivery_document',{p_id:document.id,p_expected_version:document.version});fail(error); });
export const cancelDocument = tracked('cancelDocument', async (document: DeliveryDocument,reason: string) => { const {error}=await createSupabaseBrowserClient().rpc('cancel_delivery_document',{p_id:document.id,p_reason:reason,p_expected_version:document.version});fail(error); });
export const deleteDraft = tracked('deleteDraft', async (document: DeliveryDocument) => { const {error}=await createSupabaseBrowserClient().rpc('delete_delivery_draft',{p_id:document.id,p_expected_version:document.version});fail(error); });
