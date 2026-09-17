import { SidebarTrigger } from "@/components/ui/sidebar";
import { ProductSearch } from "@/components/inventory/ProductSearch";

export default function CodiciPage() {
  return <>
    <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4"><SidebarTrigger className="-ml-1" /><span className="text-sm font-medium">Ricerca prodotto</span></header>
    <main className="mx-auto w-full max-w-5xl px-4 py-7 sm:px-6"><h1 className="text-2xl font-semibold">Trova un prodotto</h1><p className="mb-6 mt-1 text-sm text-muted-foreground">Cerca con barcode, codice interno, MAV o codice equivalente.</p><ProductSearch /></main>
  </>;
}
