"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { ImportExcelUploader } from "@/components/codici/ImportExcelUploader";
import { Moon, Sun } from "lucide-react";

export default function ImportCodiciPage() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);
  return (
    <>
      {/* Page header */}
      <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b px-4">
        <div className="flex items-center gap-2">
          <SidebarTrigger className="-ml-1" />
          <span className="text-sm font-medium">Carica Excel</span>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="flex items-center gap-2"
          onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
        >
          {mounted && resolvedTheme === "dark" ? (
            <Sun className="h-4 w-4" />
          ) : (
            <Moon className="h-4 w-4" />
          )}
          <span className="hidden md:inline text-sm">
            {mounted && resolvedTheme === "dark" ? "Tema chiaro" : "Tema scuro"}
          </span>
        </Button>
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
