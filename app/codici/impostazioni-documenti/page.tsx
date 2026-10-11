import { SidebarTrigger } from "@/components/ui/sidebar";
import { PageFrame } from "@/components/codici/PageFrame";
import { DocumentSettings } from "@/components/ddt/DocumentSettings";
import { Suspense } from "react";
export default function Page() { return <><header className="flex h-14 items-center gap-2 border-b px-4"><SidebarTrigger className="-ml-1"/><span className="text-sm font-medium">Impostazioni documenti</span></header><PageFrame title="Impostazioni documenti" description="Dati dell’officina e verifica amministrativa."><Suspense fallback={<p>Caricamento…</p>}><DocumentSettings/></Suspense></PageFrame></>; }
