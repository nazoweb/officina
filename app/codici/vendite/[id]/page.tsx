import { SaleDetail } from '@/components/sales/SaleDetail';
import { SalesPageFrame } from '@/components/sales/SalesPageFrame';
export default async function Page({params}:{params:Promise<{id:string}>}){const {id}=await params;return <SalesPageFrame title="Dettaglio vendita"><SaleDetail id={id}/></SalesPageFrame>;}
