import { SidebarTrigger } from "@/components/ui/sidebar";
import { InventoryImport } from "@/components/inventory/InventoryImport";
import { PageFrame } from "@/components/codici/PageFrame";

export default function ImportPage() { return <><header className="flex h-14 items-center gap-2 border-b px-4"><SidebarTrigger className="-ml-1" /><span className="text-sm font-medium">Importa Excel</span></header><PageFrame title="Importa listino e magazzino" description="Abbina le colonne del file ai dati del prodotto. Verifica sempre l’anteprima prima di confermare."><InventoryImport /></PageFrame></> }
