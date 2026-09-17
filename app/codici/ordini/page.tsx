import { SidebarTrigger } from "@/components/ui/sidebar";
import { OrdersList } from "@/components/inventory/Orders";
import { PageFrame } from "@/components/codici/PageFrame";
export default function OrdiniPage() { return <><header className="flex h-14 items-center gap-2 border-b px-4"><SidebarTrigger className="-ml-1" /><span className="text-sm font-medium">Liste ordini</span></header><PageFrame title="Liste ordini" description="Apri una lista e registra i ricambi con la pistola barcode."><OrdersList /></PageFrame></> }
