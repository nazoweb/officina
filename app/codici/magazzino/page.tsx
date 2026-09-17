import { SidebarTrigger } from "@/components/ui/sidebar";
import { Warehouse } from "@/components/inventory/Warehouse";

export default function MagazzinoPage() { return <><header className="flex h-14 items-center gap-2 border-b px-4"><SidebarTrigger className="-ml-1" /><span className="text-sm font-medium">Magazzino</span></header><main className="mx-auto w-full max-w-6xl px-4 py-7 sm:px-6"><h1 className="text-2xl font-semibold">Magazzino</h1><p className="mb-6 mt-1 text-sm text-muted-foreground">Prodotti, codici, prezzi e giacenze sempre aggiornati.</p><Warehouse /></main></> }
