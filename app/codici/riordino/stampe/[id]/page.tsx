import { ReorderPrintDetail } from '@/components/sales/ReorderPrintDetail';
import { SalesPageFrame } from '@/components/sales/SalesPageFrame';
export default async function Page({params}:{params:Promise<{id:string}>}){const {id}=await params;return <SalesPageFrame title="Storico stampa riordino"><ReorderPrintDetail id={id}/></SalesPageFrame>;}
