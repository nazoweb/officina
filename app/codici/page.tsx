"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTheme } from "next-themes";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { SearchCodeForm } from "@/components/codici/SearchCodeForm";
import { CodeResultCard } from "@/components/codici/CodeResultCard";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { searchByCode } from "@/lib/codici/searchReferences";
import { hasReferenceData, getReferenceStats } from "@/lib/codici/storageReferences";
import { getRecentSearches, addRecentSearch } from "@/lib/codici/recentSearches";
import { AlertCircle, FileSpreadsheet, Upload, Clock, X, Moon, Sun } from "lucide-react";
import type { SearchResult } from "@/types/codici";

type PageState = "idle" | "loading" | "results" | "not-found";

export default function CodiciPage() {
  const { resolvedTheme, setTheme } = useTheme();
  const [state, setState] = useState<PageState>("idle");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [lastQuery, setLastQuery] = useState("");
  const [mounted, setMounted] = useState(false);
  const [hasData, setHasData] = useState(false);
  const [stats, setStats] = useState({ groups: 0, codes: 0 });
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  useEffect(() => {
    const loaded = hasReferenceData();
    setHasData(loaded);
    if (loaded) setStats(getReferenceStats());
    setRecentSearches(getRecentSearches());
    setMounted(true);
  }, []);

  const handleSearch = (query: string) => {
    setState("loading");
    setLastQuery(query);

    setTimeout(() => {
      if (!hasReferenceData()) {
        setState("idle");
        return;
      }
      const found = searchByCode(query);
      if (found.length > 0) addRecentSearch(query);
      setResults(found);
      setRecentSearches(getRecentSearches());
      setState(found.length > 0 ? "results" : "not-found");
    }, 0);
  };

  return (
    <>
      {/* Page header */}
      <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b px-4">
        <div className="flex items-center gap-2">
          <SidebarTrigger className="-ml-1" />
          <span className="text-sm font-medium">Ricerca</span>
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

        {/* Search */}
        <div className="mb-8">
          <h1 className="text-xl font-semibold mb-1">Cerca un codice</h1>
          <p className="text-sm text-muted-foreground mb-5">
            Inserisci un codice MAV, interno o di un fornitore esterno.
          </p>
          <SearchCodeForm onSearch={handleSearch} loading={state === "loading"} />
        </div>

        {/* Database status bar — visible only when idle */}
        {mounted && state === "idle" && hasData && (
          <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-4 py-3 mb-6 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <span className="h-2 w-2 rounded-full bg-green-500 shrink-0" />
              <span>
                Listino attivo —{" "}
                <span className="font-medium text-foreground">
                  {stats.groups.toLocaleString("it-IT")} prodotti,{" "}
                  {stats.codes.toLocaleString("it-IT")} codici
                </span>
              </span>
            </div>
            <Link
              href="/codici/tabella"
              className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-4 shrink-0 ml-4"
            >
              Vedi tutti
            </Link>
          </div>
        )}

        {/* Recent searches */}
        {mounted && state === "idle" && hasData && recentSearches.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center gap-1.5 mb-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
              <Clock className="h-3 w-3" />
              Ricerche recenti
            </div>
            <div className="flex flex-wrap gap-2">
              {recentSearches.map((q) => (
                <button
                  key={q}
                  onClick={() => handleSearch(q)}
                  className="font-mono text-xs rounded-md border px-2.5 py-1 hover:bg-muted transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        <Separator className="mb-6" />

        {/* Loading */}
        {state === "loading" && (
          <div className="space-y-3">
            <Skeleton className="h-10 w-full rounded-lg" />
            <Skeleton className="h-36 w-full rounded-lg" />
          </div>
        )}

        {/* Not found */}
        {state === "not-found" && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Nessun codice trovato per{" "}
              <span className="font-mono font-semibold">{lastQuery}</span>.
              Controlla di aver scritto correttamente il codice.
            </AlertDescription>
          </Alert>
        )}

        {/* Results */}
        {state === "results" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {results.length === 1 ? "1 risultato" : `${results.length} risultati`}
                {" "}per{" "}
                <span className="font-mono font-semibold text-foreground">{lastQuery}</span>
              </p>
              <button
                onClick={() => setState("idle")}
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
              >
                <X className="h-3 w-3" /> Chiudi
              </button>
            </div>
            {results.map((result, i) => (
              <CodeResultCard
                key={result.group.id}
                result={result}
                showGroupNumber={results.length > 1}
                groupNumber={i + 1}
              />
            ))}
          </div>
        )}

        {/* Empty states — rendered only after mount to avoid flash */}
        {!mounted && state === "idle" && (
          <div className="space-y-3">
            <Skeleton className="h-12 w-full rounded-lg" />
            <Skeleton className="h-8 w-2/3 rounded-lg" />
          </div>
        )}
        {mounted && state === "idle" && !hasData && <EmptyNoData />}
        {mounted && state === "idle" && hasData && recentSearches.length === 0 && (
          <p className="text-center text-sm text-muted-foreground py-4">
            Inserisci un codice per vedere le corrispondenze.
          </p>
        )}

      </div>
    </>
  );
}

function EmptyNoData() {
  return (
    <div className="rounded-xl border bg-card p-8">
      <div className="mb-6 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
          <FileSpreadsheet className="h-6 w-6 text-muted-foreground" />
        </div>
        <h2 className="font-semibold text-base mb-1">Nessun listino caricato</h2>
        <p className="text-sm text-muted-foreground max-w-xs mx-auto">
          Carica il listino prodotti per poter cercare i codici.
        </p>
      </div>

      <Separator className="mb-6" />

      <ol className="space-y-4 mb-6">
        <Step
          number={1}
          title="Prepara il file Excel"
          description={
            <>
              Il file deve avere le colonne{" "}
              <span className="font-mono text-xs bg-muted px-1 py-0.5 rounded">Codici MAV</span>,{" "}
              <span className="font-mono text-xs bg-muted px-1 py-0.5 rounded">CODICE INTERNO</span>{" "}
              e{" "}
              <span className="font-mono text-xs bg-muted px-1 py-0.5 rounded">CROSS REFERENCE</span>.
            </>
          }
        />
        <Step
          number={2}
          title="Carica il file"
          description="Vai alla pagina di importazione e seleziona il tuo file .xlsx. I dati vengono indicizzati automaticamente."
        />
        <Step
          number={3}
          title="Inizia a cercare"
          description="Inserisci qualsiasi codice — MAV, interno o di un fornitore esterno — e trovi subito tutti i codici equivalenti."
        />
      </ol>

      <Button className="w-full" asChild>
        <Link href="/codici/import">
          <Upload className="mr-2 h-4 w-4" />
          Carica il listino
        </Link>
      </Button>
    </div>
  );
}

function Step({ number, title, description }: { number: number; title: string; description: React.ReactNode }) {
  return (
    <li className="flex gap-4">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold mt-0.5">
        {number}
      </div>
      <div>
        <p className="font-medium text-sm leading-tight mb-0.5">{title}</p>
        <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
      </div>
    </li>
  );
}
