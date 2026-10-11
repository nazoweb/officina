import { SidebarTrigger } from "@/components/ui/sidebar";
import { PageFrame } from "@/components/codici/PageFrame";
import { DocumentsList } from "@/components/ddt/DocumentsList";
import { Suspense } from "react";
export default function Page() { return <><header className="flex h-14 items-center gap-2 border-b px-4"><SidebarTrigger className="-ml-1"/><span className="text-sm font-medium">DDT e consegne</span></header><PageFrame title="DDT e consegne" description="Documenti per aziende, ricambi e prestazioni."><Suspense fallback={<p>Caricamento…</p>}><DocumentsList/></Suspense></PageFrame></>; }
