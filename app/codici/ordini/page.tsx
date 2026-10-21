import Link from "next/link";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { OrdersList } from "@/components/inventory/Orders";
import { PageFrame } from "@/components/codici/PageFrame";
export default function OrdiniPage() { return <><header className="flex h-14 items-center gap-2 border-b px-4"><SidebarTrigger className="-ml-1" /><span className="text-sm font-medium">Liste ordini</span></header><PageFrame title="Liste ordini" description="Apri una lista e registra i ricambi con la pistola barcode."><div className="mb-5 flex flex-wrap items-center gap-3 rounded-xl border bg-muted/30 p-4"><p className="flex-1 text-sm">Per registrare una nuova vendita con scontrino interno e lista da riordinare usa il Carrello vendita. Queste liste mantengono il precedente scarico alla scansione.</p><Button asChild variant="outline"><Link href="/codici/vendite">Vai al carrello vendita</Link></Button></div><OrdersList /></PageFrame></> }
