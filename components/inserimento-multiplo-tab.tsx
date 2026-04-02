"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Field, FieldLabel } from "@/components/ui/field";
import { encodeBulkInput, type EncodeResult } from "@/lib/coding";
import { exportRowsToCsv, type CsvRow } from "@/lib/csv";
import { Copy, Download, Check, AlertCircle, AlertTriangle, Loader2 } from "lucide-react";

interface BulkError {
  input: string;
  error: string;
}

const STORAGE_KEY = "inserimento-multiplo-tab-state";

interface StoredState {
  input: string;
  results: EncodeResult[];
}

export function InserimentoMultiploTab() {
  const [input, setInput] = useState("");
  const [results, setResults] = useState<EncodeResult[]>([]);
  const [errors, setErrors] = useState<BulkError[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed: StoredState = JSON.parse(stored);
        setInput(parsed.input);
        setResults(parsed.results);
      } catch {
        // Invalid JSON, ignore
      }
    }
  }, []);

  // Save to localStorage when state changes
  useEffect(() => {
    const state: StoredState = { input, results };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [input, results]);

  const handleProcess = async () => {
    setResults([]);
    setErrors([]);

    if (!input.trim()) {
      setErrors([{ input: "", error: "Inserisci almeno un elemento" }]);
      return;
    }

    setIsLoading(true);

    try {
      const { results: newResults, errors: newErrors } = await encodeBulkInput(input);
      setResults(newResults);
      setErrors(newErrors);
    } catch (err) {
      setErrors([
        {
          input: "",
          error: err instanceof Error ? err.message : "Errore durante l'elaborazione",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyAll = async () => {
    const text = results.map((r) => r.stockCode).join("\n");
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopySingle = async (code: string) => {
    await navigator.clipboard.writeText(code);
  };

  const handleExportCsv = () => {
    const rows: CsvRow[] = results.map((r) => ({
      categoria: r.categoryCode,
      nome_categoria: r.categoryName,
      codice_produttore: r.producerCode,
      codice_magazzino: r.stockCode,
    }));
    exportRowsToCsv(rows);
  };

  const handleReset = () => {
    setInput("");
    setResults([]);
    setErrors([]);
    localStorage.removeItem(STORAGE_KEY);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Inserimento Multiplo</CardTitle>
        <CardDescription>
          Codifica più elementi con categorie diverse in un&apos;unica operazione
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <Field>
          <FieldLabel htmlFor="bulk-input">Input Multiplo</FieldLabel>
          <Textarea
            id="bulk-input"
            placeholder="01-BOSCH123;02-PHILIPS999;03-VARTA45"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            rows={5}
          />
          <p className="text-sm text-muted-foreground">
            Formato: CATEGORIA-CODICE_PRODUTTORE separati da punto e virgola (;)
          </p>
        </Field>

        <div className="flex gap-3">
          <Button onClick={handleProcess} disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Elabora
          </Button>
          <Button variant="outline" onClick={handleReset}>
            Pulisci
          </Button>
        </div>

        {errors.length > 0 && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Errori rilevati</AlertTitle>
            <AlertDescription>
              <ul className="mt-2 list-inside list-disc space-y-1">
                {errors.map((err, index) => (
                  <li key={index}>
                    {err.input && <code className="mr-1">{err.input}</code>}
                    {err.error}
                  </li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        {results.length > 0 && (
          <>
            <Separator />
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">
                  Risultati Validi <Badge variant="secondary">{results.length}</Badge>
                </h3>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={handleCopyAll}>
                    {copied ? (
                      <Check className="mr-2 h-4 w-4" />
                    ) : (
                      <Copy className="mr-2 h-4 w-4" />
                    )}
                    {copied ? "Copiato!" : "Copia tutto"}
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleExportCsv}>
                    <Download className="mr-2 h-4 w-4" />
                    Scarica CSV
                  </Button>
                </div>
              </div>

              <div className="rounded-lg border bg-muted/50 p-4">
                <div className="space-y-2">
                  {results.map((result, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between rounded-md bg-background p-3 font-mono text-sm"
                    >
                      <div className="flex flex-col gap-1">
                        <span className="font-semibold">{result.stockCode}</span>
                        <span className="text-xs text-muted-foreground">
                          {result.categoryName} • {result.producerCode}
                        </span>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleCopySingle(result.stockCode)}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}

        {results.length === 0 && errors.length === 0 && (
          <div className="rounded-lg border border-dashed p-8 text-center">
            <AlertCircle className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-2 text-sm text-muted-foreground">
              I risultati appariranno qui dopo l&apos;elaborazione
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
