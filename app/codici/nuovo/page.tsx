"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { NuovoCodiceForm } from "@/components/codici/NuovoCodiceForm";
import { Moon, Sun } from "lucide-react";

export default function NuovoCodice() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);
  return (
    <>
      <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b px-4">
        <div className="flex items-center gap-2">
          <SidebarTrigger className="-ml-1" />
          <span className="text-sm font-medium">Crea codice</span>
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
