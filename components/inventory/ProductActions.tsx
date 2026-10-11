"use client";

import { useState } from "react";
import Link from "next/link";
import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { deleteProduct } from "@/lib/inventory/api";
import type { Product } from "@/types/inventory";
import { ConfirmAction } from "./ConfirmAction";

export function ProductActions({ product, onDeleted }: { product: Product; onDeleted: () => void | Promise<void> }) {
  const [open, setOpen] = useState(false);
  return <>
    <Button variant="outline" asChild><Link href={`/codici/prodotti/${product.id}`}><Pencil className="mr-2 h-4 w-4" />Modifica</Link></Button>
    <Button variant="outline" className="text-destructive" onClick={() => setOpen(true)}><Trash2 className="mr-2 h-4 w-4" />Elimina</Button>
    <ConfirmAction open={open} onOpenChange={setOpen} title={`Eliminare ${product.internal_code}?`} description="Il prodotto, i suoi codici e i suoi prezzi verranno eliminati dal catalogo. Gli ordini già registrati conserveranno nome e codice. L’operazione non è annullabile." onConfirm={async () => { await deleteProduct(product.id); await onDeleted(); }} />
  </>;
}
