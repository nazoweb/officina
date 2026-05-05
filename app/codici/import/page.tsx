"use client";

import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { ImportExcelUploader } from "@/components/codici/ImportExcelUploader";

export default function ImportCodiciPage() {
  return (
    <>
      {/* Page header */}
      <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
        <SidebarTrigger className="-ml-1" />
        <span className="text-sm font-medium">Carica Excel</span>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-8 w-full">

        <div className="mb-8">
          <h1 className="text-xl font-semibold mb-1">Carica Excel</h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Importa il file Excel per aggiornare i codici disponibili.
            I dati precedentemente caricati verranno sostituiti.
          </p>
        </div>

        <Separator className="mb-8" />

        {/* Columns hint */}
        <div className="mb-6 rounded-lg border bg-muted/30 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
            Colonne richieste nel file
          </p>
          <div className="flex flex-wrap gap-2">
            {["Codici MAV", "CODICE INTERNO", "CROSS REFERENCE"].map((col) => (
              <span
                key={col}
                className="font-mono text-xs bg-background border rounded px-2 py-1"
              >
                {col}
              </span>
            ))}
          </div>
        </div>

        <ImportExcelUploader />

      </div>
    </>
  );
}
