import { SidebarTrigger } from "@/components/ui/sidebar";
import { PageFrame } from "@/components/codici/PageFrame";
import { Clients } from "@/components/ddt/Clients";
import { Suspense } from "react";
export default function Page() { return <><header className="flex h-14 items-center gap-2 border-b px-4"><SidebarTrigger className="-ml-1"/><span className="text-sm font-medium">Aziende</span></header><PageFrame title="Aziende" description="Anagrafiche e storico documenti dei clienti aziendali."><Suspense fallback={<p>Caricamento…</p>}><Clients/></Suspense></PageFrame></>; }
