import { SidebarTrigger } from "@/components/ui/sidebar";
import { OrdersList } from "@/components/inventory/Orders";
export default function OrdiniPage() { return <><header className="flex h-14 items-center gap-2 border-b px-4"><SidebarTrigger className="-ml-1" /><span className="text-sm font-medium">Liste ordini</span></header><main className="mx-auto w-full max-w-5xl px-4 py-7 sm:px-6"><h1 className="text-2xl font-semibold">Liste ordini</h1><p className="mb-6 mt-1 text-sm text-muted-foreground">Apri una lista e registra i ricambi con la pistola barcode.</p><OrdersList /></main></> }
