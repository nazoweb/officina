"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Field, FieldLabel } from "@/components/ui/field";
import { ResultsTable } from "@/components/results-table";
import { encodeProducerCode, type EncodeResult } from "@/lib/coding";
import { normalizeCategory, isValidCategory } from "@/lib/categories";
import { addHistoryEntry, getSettings } from "@/lib/storage";
import type { BulkError } from "@/types";
import { AlertTriangle, Loader2 } from "lucide-react";

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

  /**
   * Parse bulk input with improved normalization
   * Accepts variations:
   * - "01-BOSCH123"
   * - "01 - BOSCH123"
   * - "01:BOSCH123"
   * - extra spaces
   * Separators: ; or newline
   */
  const parseInput = (rawInput: string): { category: string; producerCode: string }[] => {
    const items = rawInput
      .split(/[;\n]/)
      .map((item) => item.trim())
      .filter((item) => item.length > 0);

    return items.map((item) => {
      // Find the separator (first occurrence of - or :)
      const separatorMatch = item.match(/\s*[-:]\s*/);
      
      if (!separatorMatch || separatorMatch.index === undefined) {
        return { category: "", producerCode: item };
      }

      const separatorIndex = separatorMatch.index;
      const separatorLength = separatorMatch[0].length;
      
      const category = item.substring(0, separatorIndex).trim();
      const producerCode = item.substring(separatorIndex + separatorLength).trim();

      return { category, producerCode };
    });
  };

  const handleProcess = async () => {
    setResults([]);
    setErrors([]);

    if (!input.trim()) {
      setErrors([{ input: "", error: "Inserisci almeno un elemento" }]);
      return;
    }

    setIsLoading(true);

    const parsedItems = parseInput(input);
    const newResults: EncodeResult[] = [];
    const newErrors: BulkError[] = [];

    for (const item of parsedItems) {
      // Validate format
      if (!item.category || !item.producerCode) {
        newErrors.push({
          input: `${item.category || "?"}${item.category ? "-" : ""}${item.producerCode || "?"}`,
          error: "Formato non valido: deve essere CATEGORIA-CODICE_PRODUTTORE",
        });
        continue;
      }

      // Normalize and validate category
      const normalizedCategory = normalizeCategory(item.category);
      if (!isValidCategory(normalizedCategory)) {
        newErrors.push({
          input: `${item.category}-${item.producerCode}`,
          error: `Categoria non valida: ${item.category}`,
        });
        continue;
      }

      try {
        const result = await encodeProducerCode(normalizedCategory, item.producerCode);
        newResults.push(result);
      } catch (err) {
        newErrors.push({
          input: `${item.category}-${item.producerCode}`,
          error: err instanceof Error ? err.message : "Errore sconosciuto",
        });
      }
    }

    setResults(newResults);
    setErrors(newErrors);

    // Save to history if enabled and we have results
    if (newResults.length > 0) {
      const settings = getSettings();
      if (settings.autoSaveHistory) {
        addHistoryEntry({
          type: "multiplo",
          input,
          results: newResults,
          errors: newErrors.length > 0 ? newErrors : undefined,
        });
      }
    }

    setIsLoading(false);
  };

  const handleRemoveRow = (index: number) => {
    setResults((prev) => prev.filter((_, i) => i !== index));
  };

  const handleClearResults = () => {
    setResults([]);
    setErrors([]);
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
            placeholder="01-BOSCH123&#10;02-PHILIPS999&#10;03-VARTA45"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            rows={5}
          />
          <p className="text-sm text-muted-foreground">
            Formato: CATEGORIA-CODICE_PRODUTTORE separati da punto e virgola (;) o su righe
            separate. Accetta anche &quot;01 - ABC&quot; o &quot;01:ABC&quot;
          </p>
        </Field>

        <div className="flex gap-3">
          <Button onClick={handleProcess} disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Elabora
          </Button>
          <Button variant="outline" onClick={handleReset}>
            Pulisci tutto
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

        <Separator />

        <ResultsTable
          results={results}
          onRemoveRow={handleRemoveRow}
          onClearAll={results.length > 0 ? handleClearResults : undefined}
          emptyMessage="Nessun risultato"
        />
      </CardContent>
    </Card>
  );
}
