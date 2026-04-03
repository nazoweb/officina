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
import { Separator } from "@/components/ui/separator";
import { FieldGroup, Field, FieldLabel } from "@/components/ui/field";
import { ResultsTable } from "@/components/results-table";
import {
  getCategoryOptions,
  getCategoryUpdateEventName,
  isValidCategory,
} from "@/lib/categories";
import { encodeProducerCode, type EncodeResult } from "@/lib/coding";
import { addHistoryEntry, getSettings } from "@/lib/storage";
import { AlertCircle, Loader2 } from "lucide-react";

const STORAGE_KEY = "codifica-tab-state";

interface StoredState {
  category: string;
  producerCodes: string;
  results: EncodeResult[];
}

export function CodificaTab() {
  const [category, setCategory] = useState("");
  const [producerCodes, setProducerCodes] = useState("");
  const [results, setResults] = useState<EncodeResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [categoryOptions, setCategoryOptions] = useState<[string, string][]>([]);

  // Load from localStorage on mount
  useEffect(() => {
    const refreshCategoryOptions = () => {
      setCategoryOptions(getCategoryOptions());
    };

    refreshCategoryOptions();

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

    const categoryEvent = getCategoryUpdateEventName();
    window.addEventListener(categoryEvent, refreshCategoryOptions);
    window.addEventListener("storage", refreshCategoryOptions);

    return () => {
      window.removeEventListener(categoryEvent, refreshCategoryOptions);
      window.removeEventListener("storage", refreshCategoryOptions);
    };
  }, []);

  useEffect(() => {
    if (category && !isValidCategory(category)) {
      setCategory("");
    }
  }, [category, categoryOptions]);

  // Save to localStorage when state changes
  useEffect(() => {
    const state: StoredState = { category, producerCodes, results };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [category, producerCodes, results]);

  /**
   * Normalize input to handle various separator formats
   * Accepts: ; or newline as separators
   * Handles extra spaces
   */
  const parseInput = (input: string): string[] => {
    return input
      .split(/[;\n]/)
      .map((code) => code.trim())
      .filter((code) => code.length > 0);
  };

  const handleGenerate = async () => {
    setError(null);
    setResults([]);

    if (!category) {
      setError("Seleziona una categoria");
      return;
    }

    const codes = parseInput(producerCodes);

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

      // Save to history if enabled
      const settings = getSettings();
      if (settings.autoSaveHistory) {
        addHistoryEntry({
          type: "codifica",
          input: producerCodes,
          results: newResults,
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore durante la codifica");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveRow = (index: number) => {
    setResults((prev) => prev.filter((_, i) => i !== index));
  };

  const handleClearResults = () => {
    setResults([]);
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
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger id="category">
                <SelectValue placeholder="Seleziona categoria" />
              </SelectTrigger>
              <SelectContent>
                {categoryOptions.map(([code, name]) => (
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
              placeholder="BOSCH123&#10;VALEO77&#10;MAGNETI9"
              value={producerCodes}
              onChange={(e) => setProducerCodes(e.target.value)}
              rows={4}
            />
            <p className="text-sm text-muted-foreground">
              Inserisci uno o più codici separati da punto e virgola (;) o su righe separate
            </p>
          </Field>
        </FieldGroup>

        <div className="flex gap-3">
          <Button onClick={handleGenerate} disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Genera
          </Button>
          <Button variant="outline" onClick={handleReset}>
            Pulisci tutto
          </Button>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {(results.length > 0 || !error) && (
          <>
            <Separator />
            <ResultsTable
              results={results}
              onRemoveRow={handleRemoveRow}
              onClearAll={results.length > 0 ? handleClearResults : undefined}
              emptyMessage="Nessun risultato"
            />
          </>
        )}
      </CardContent>
    </Card>
  );
}
