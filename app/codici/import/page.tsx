import { SidebarTrigger } from "@/components/ui/sidebar";
import { InventoryImport } from "@/components/inventory/InventoryImport";

export default function ImportPage() { return <><header className="flex h-14 items-center gap-2 border-b px-4"><SidebarTrigger className="-ml-1" /><span className="text-sm font-medium">Importa Excel</span></header><main className="mx-auto w-full max-w-5xl px-4 py-7 sm:px-6"><h1 className="text-2xl font-semibold">Importa listino e magazzino</h1><p className="mb-6 mt-1 text-sm text-muted-foreground">Abbina le colonne del file ai dati del prodotto. Verifica sempre l’anteprima prima di confermare.</p><InventoryImport /></main></> }
