import { SidebarTrigger } from "@/components/ui/sidebar";
import { ProductSearch } from "@/components/inventory/ProductSearch";
import { PageFrame } from "@/components/codici/PageFrame";

export default function CodiciPage() {
  return <>
    <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4"><SidebarTrigger className="-ml-1" /><span className="text-sm font-medium">Ricerca prodotto</span></header>
    <PageFrame title="Trova un prodotto" description="Cerca con barcode, codice interno, MAV o codice equivalente."><ProductSearch /></PageFrame>
  </>;
}
