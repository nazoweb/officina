"use client";

import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { NuovoCodiceForm } from "@/components/codici/NuovoCodiceForm";

export default function NuovoCodice() {
  return (
    <>
      <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
        <SidebarTrigger className="-ml-1" />
        <span className="text-sm font-medium">Crea codice</span>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-8 w-full">
        <div className="mb-8">
          <h1 className="text-xl font-semibold mb-1">Crea codice</h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Aggiungi manualmente un nuovo prodotto con i relativi codici.
            La struttura rispecchia le colonne del file Excel.
          </p>
        </div>

        <Separator className="mb-8" />

        <NuovoCodiceForm />
      </div>
    </>
  );
}
