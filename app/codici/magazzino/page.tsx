import { SidebarTrigger } from "@/components/ui/sidebar";
import { Warehouse } from "@/components/inventory/Warehouse";
import { PageFrame } from "@/components/codici/PageFrame";

export default function MagazzinoPage() { return <><header className="flex h-14 items-center gap-2 border-b px-4"><SidebarTrigger className="-ml-1" /><span className="text-sm font-medium">Magazzino</span></header><PageFrame title="Magazzino" description="Prodotti, codici, prezzi e giacenze sempre aggiornati."><Warehouse /></PageFrame></> }
