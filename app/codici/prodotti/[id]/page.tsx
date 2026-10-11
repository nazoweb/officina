import { SidebarTrigger } from "@/components/ui/sidebar";
import { ProductEditor } from "@/components/inventory/ProductForm";
import { PageFrame } from "@/components/codici/PageFrame";

export default async function ModificaProdottoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <><header className="flex h-14 items-center gap-2 border-b px-4"><SidebarTrigger className="-ml-1" /><span className="text-sm font-medium">Modifica prodotto</span></header><PageFrame title="Modifica prodotto" description="Aggiorna dati, codici, prezzi e giacenza direttamente dal sito."><ProductEditor productId={id} /></PageFrame></>;
}
