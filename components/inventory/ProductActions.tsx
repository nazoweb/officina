"use client";

import { useState } from "react";
import Link from "next/link";
import { MoreHorizontal, PackagePlus, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { deleteProduct } from "@/lib/inventory/api";
import type { Product } from "@/types/inventory";
import { ConfirmAction } from "./ConfirmAction";

export function ProductActions({ product, onDeleted, onAdjustStock }: { product: Product; onDeleted: () => void | Promise<void>; onAdjustStock?: () => void }) {
  const [open, setOpen] = useState(false);
  return <>
    <DropdownMenu>
      <DropdownMenuTrigger asChild><Button variant="outline" size="icon" aria-label={`Azioni per ${product.internal_code}`}><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem asChild><Link href={`/codici/prodotti/${product.id}`}><Pencil />Modifica</Link></DropdownMenuItem>
        {onAdjustStock && <DropdownMenuItem onSelect={onAdjustStock}><PackagePlus />Rettifica giacenza</DropdownMenuItem>}
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={() => setOpen(true)}><Trash2 />Elimina</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
    <ConfirmAction open={open} onOpenChange={setOpen} title={`Eliminare ${product.internal_code}?`} description="Il prodotto, i suoi codici e i suoi prezzi verranno eliminati dal catalogo. Gli ordini già registrati conserveranno nome e codice. L’operazione non è annullabile." onConfirm={async () => { await deleteProduct(product.id); await onDeleted(); }} />
  </>;
}
