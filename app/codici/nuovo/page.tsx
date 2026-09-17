import { SidebarTrigger } from "@/components/ui/sidebar";
import { ProductForm } from "@/components/inventory/ProductForm";

export default function NuovoProdottoPage() { return <><header className="flex h-14 items-center gap-2 border-b px-4"><SidebarTrigger className="-ml-1" /><span className="text-sm font-medium">Nuovo prodotto</span></header><main className="mx-auto w-full max-w-5xl px-4 py-7 sm:px-6"><h1 className="text-2xl font-semibold">Nuovo prodotto</h1><p className="mb-6 mt-1 text-sm text-muted-foreground">Inserisci le informazioni disponibili. Potrai completarle con l’import Excel.</p><ProductForm /></main></> }
