import { SidebarTrigger } from "@/components/ui/sidebar";
import { PageFrame } from "@/components/codici/PageFrame";
import { DocumentDetail } from "@/components/ddt/DocumentDetail";
export default async function Page({params}:{params:Promise<{id:string}>}){ const {id}=await params;return <><header className="flex h-14 items-center gap-2 border-b px-4"><SidebarTrigger/><span className="text-sm font-medium">Documento</span></header><PageFrame title="Documento" description="Controlla, emetti e stampa il documento."><DocumentDetail id={id}/></PageFrame></>; }
