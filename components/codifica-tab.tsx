"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { FieldGroup, Field, FieldLabel } from "@/components/ui/field";
import { CATEGORIES, type CategoryCode } from "@/lib/categories";
import { encodeProducerCode, type EncodeResult } from "@/lib/coding";
import { exportRowsToCsv, type CsvRow } from "@/lib/csv";
import { Copy, Download, Check, AlertCircle, Loader2 } from "lucide-react";

const STORAGE_KEY = "codifica-tab-state";

interface StoredState {
  category: CategoryCode | "";
  producerCodes: string;
  results: EncodeResult[];
}

export function CodificaTab() {
  const [category, setCategory] = useState<CategoryCode | "">("");
  const [producerCodes, setProducerCodes] = useState("");
  const [results, setResults] = useState<EncodeResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed: StoredState = JSON.parse(stored);
        setCategory(parsed.category);
        setProducerCodes(parsed.producerCodes);
        setResults(parsed.results);
      } catch {
        // Invalid JSON, ignore
      }
    }
  }, []);

  // Save to localStorage when state changes
  useEffect(() => {
    const state: StoredState = { category, producerCodes, results };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [category, producerCodes, results]);

  const handleGenerate = async () => {
    setError(null);
    setResults([]);

    if (!category) {
      setError("Seleziona una categoria");
      return;
    }

    const codes = producerCodes
      .split(";")
      .map((code) => code.trim())
      .filter((code) => code.length > 0);

    if (codes.length === 0) {
      setError("Inserisci almeno un codice produttore");
      return;
    }

    setIsLoading(true);

    try {
      const newResults: EncodeResult[] = [];
      for (const code of codes) {
        const result = await encodeProducerCode(category, code);
        newResults.push(result);
      }
      setResults(newResults);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore durante la codifica");
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
    setCategory("");
    setProducerCodes("");
    setResults([]);
    setError(null);
    localStorage.removeItem(STORAGE_KEY);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Codifica Codici Produttore</CardTitle>
        <CardDescription>
          Genera codici magazzino a partire dai codici produttore originali
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="category">Categoria</FieldLabel>
            <Select value={category} onValueChange={(v) => setCategory(v as CategoryCode)}>
              <SelectTrigger id="category">
                <SelectValue placeholder="Seleziona categoria" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(CATEGORIES).map(([code, name]) => (
                  <SelectItem key={code} value={code}>
                    {code} - {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field>
            <FieldLabel htmlFor="producer-codes">Codici Produttore</FieldLabel>
            <Textarea
              id="producer-codes"
              placeholder="BOSCH123 oppure BOSCH123;VALEO77;MAGNETI9"
              value={producerCodes}
              onChange={(e) => setProducerCodes(e.target.value)}
              rows={4}
            />
            <p className="text-sm text-muted-foreground">
              Inserisci uno o più codici separati da punto e virgola (;)
            </p>
          </Field>
        </FieldGroup>

        <div className="flex gap-3">
          <Button onClick={handleGenerate} disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Genera
          </Button>
          <Button variant="outline" onClick={handleReset}>
            Pulisci
          </Button>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {results.length > 0 && (
          <>
            <Separator />
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">
                  Risultati <Badge variant="secondary">{results.length}</Badge>
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
      </CardContent>
    </Card>
  );
}
