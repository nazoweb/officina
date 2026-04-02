"use client";

import { useEffect, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { CodificaTab } from "@/components/codifica-tab";
import { DecodificaTab } from "@/components/decodifica-tab";
import { InserimentoMultiploTab } from "@/components/inserimento-multiplo-tab";
import { StoricoTab } from "@/components/storico-tab";
import { ImpostazioniTab } from "@/components/impostazioni-tab";
import { runInternalTests } from "@/lib/coding";
import { getSettings, saveSettings } from "@/lib/storage";
import { useTheme } from "next-themes";
import { Warehouse, Code2, Unlock, ListPlus, History, Settings, Moon, Sun } from "lucide-react";

export default function Home() {
  const [activeTab, setActiveTab] = useState("codifica");
  const [key, setKey] = useState(0); // For forcing re-render on data clear
  const [mounted, setMounted] = useState(false);
  const { resolvedTheme, setTheme } = useTheme();

  useEffect(() => {
    setMounted(true);
    setTheme(getSettings().theme);
  }, [setTheme]);

  // Run internal tests in development mode
  useEffect(() => {
    if (process.env.NODE_ENV === "development") {
      runInternalTests().catch(console.error);
    }
  }, []);

  const handleDataCleared = () => {
    // Force re-render of all tabs by changing key
    setKey((prev) => prev + 1);
    setActiveTab("codifica");
  };

  const handleToggleTheme = () => {
    const nextTheme = resolvedTheme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    saveSettings({ ...getSettings(), theme: nextTheme });
  };

  const currentVisibleTheme = mounted && resolvedTheme === "dark" ? "Scuro" : "Chiaro";

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto max-w-5xl px-4 py-8">
          {/* Header */}
          <header className="mb-8">
            <div className="mb-2 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <Warehouse className="h-5 w-5" />
                </div>
                <h1 className="text-2xl font-bold tracking-tight text-balance">
                  Gestione Codici Magazzino
                </h1>
              </div>
              <Button variant="outline" size="sm" onClick={handleToggleTheme}>
                {mounted && resolvedTheme === "dark" ? (
                  <Sun className="mr-2 h-4 w-4" />
                ) : (
                  <Moon className="mr-2 h-4 w-4" />
                )}
                {currentVisibleTheme}
              </Button>
            </div>
            <p className="text-muted-foreground">
              Strumento interno per la codifica e decodifica dei codici magazzino
              dell&apos;officina meccanica
            </p>
          </header>

          {/* Main Content */}
          <Tabs
            key={key}
            value={activeTab}
            onValueChange={setActiveTab}
            className="space-y-6"
          >
            <TabsList className="grid w-full grid-cols-5">
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
                <span className="hidden md:inline">Inserimento</span>
                <span className="hidden lg:inline"> multiplo</span>
              </TabsTrigger>
              <TabsTrigger value="storico" className="flex items-center gap-2">
                <History className="h-4 w-4" />
                <span className="hidden sm:inline">Storico</span>
              </TabsTrigger>
              <TabsTrigger value="impostazioni" className="flex items-center gap-2">
                <Settings className="h-4 w-4" />
                <span className="hidden sm:inline">Impostazioni</span>
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

            <TabsContent value="storico">
              <StoricoTab />
            </TabsContent>

            <TabsContent value="impostazioni">
              <ImpostazioniTab onDataCleared={handleDataCleared} />
            </TabsContent>
          </Tabs>
      </div>
    </div>
  );
}
