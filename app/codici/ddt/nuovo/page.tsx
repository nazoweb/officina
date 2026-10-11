import { SidebarTrigger } from "@/components/ui/sidebar";
import { PageFrame } from "@/components/codici/PageFrame";
import { DocumentEditor } from "@/components/ddt/DocumentEditor";
import { Suspense } from "react";
export default function Page() { return <><header className="flex h-14 items-center gap-2 border-b px-4"><SidebarTrigger className="-ml-1"/><span className="text-sm font-medium">Nuovo documento</span></header><PageFrame title="Nuovo documento" description="Crea una bozza e controllala prima di emettere."><Suspense fallback={<p>Caricamento…</p>}><DocumentEditor/></Suspense></PageFrame></>; }
