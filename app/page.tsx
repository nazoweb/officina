"use client";

import { useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CodificaTab } from "@/components/codifica-tab";
import { DecodificaTab } from "@/components/decodifica-tab";
import { InserimentoMultiploTab } from "@/components/inserimento-multiplo-tab";
import { runInternalTests } from "@/lib/coding";
import { Warehouse, Code2, Unlock, ListPlus } from "lucide-react";

export default function Home() {
  // Run internal tests in development mode
  useEffect(() => {
    if (process.env.NODE_ENV === "development") {
      runInternalTests().catch(console.error);
    }
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto max-w-4xl px-4 py-8">
        {/* Header */}
        <header className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Warehouse className="h-5 w-5" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-balance">
              Gestione Codici Magazzino
            </h1>
          </div>
          <p className="text-muted-foreground">
            Strumento interno per la codifica e decodifica dei codici magazzino dell&apos;officina meccanica
          </p>
        </header>

        {/* Main Content */}
        <Tabs defaultValue="codifica" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="codifica" className="flex items-center gap-2">
              <Code2 className="h-4 w-4" />
              <span className="hidden sm:inline">Codifica</span>
            </TabsTrigger>
            <TabsTrigger value="decodifica" className="flex items-center gap-2">
              <Unlock className="h-4 w-4" />
              <span className="hidden sm:inline">Decodifica</span>
            </TabsTrigger>
            <TabsTrigger value="multiplo" className="flex items-center gap-2">
              <ListPlus className="h-4 w-4" />
              <span className="hidden sm:inline">Inserimento multiplo</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="codifica">
            <CodificaTab />
          </TabsContent>

          <TabsContent value="decodifica">
            <DecodificaTab />
          </TabsContent>

          <TabsContent value="multiplo">
            <InserimentoMultiploTab />
          </TabsContent>
        </Tabs>

        {/* Footer */}
        <footer className="mt-12 border-t pt-6 text-center text-sm text-muted-foreground">
          <p>Gestione Codici Magazzino • Officina Meccanica</p>
        </footer>
      </div>
    </div>
  );
}
