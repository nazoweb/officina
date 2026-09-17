import { SidebarTrigger } from "@/components/ui/sidebar";
import { ProductForm } from "@/components/inventory/ProductForm";
import { PageFrame } from "@/components/codici/PageFrame";

export default function NuovoProdottoPage() { return <><header className="flex h-14 items-center gap-2 border-b px-4"><SidebarTrigger className="-ml-1" /><span className="text-sm font-medium">Nuovo prodotto</span></header><PageFrame title="Nuovo prodotto" description="Inserisci le informazioni disponibili. Potrai completarle con l’import Excel."><ProductForm /></PageFrame></> }
