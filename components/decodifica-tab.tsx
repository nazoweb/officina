"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Empty, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty";
import { Field, FieldLabel } from "@/components/ui/field";
import { decodeStockCode, type DecodeResult } from "@/lib/coding";
import { addHistoryEntry, getSettings } from "@/lib/storage";
import type { BulkError } from "@/types";
import {
  Copy,
  Check,
  AlertCircle,
  AlertTriangle,
  Loader2,
  MoreHorizontal,
  Trash2,
  FileSearch,
  Download,
  ChevronDown,
} from "lucide-react";

const STORAGE_KEY = "decodifica-tab-state";

// Extended result with original stock code
interface ExtendedDecodeResult extends DecodeResult {
  stockCode: string;
}

interface StoredState {
  stockCodes: string;
  results: ExtendedDecodeResult[];
}

export function DecodificaTab() {
  const [stockCodes, setStockCodes] = useState("");
  const [results, setResults] = useState<ExtendedDecodeResult[]>([]);
  const [errors, setErrors] = useState<BulkError[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState<number | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed: StoredState = JSON.parse(stored);
        setStockCodes(parsed.stockCodes);
        setResults(parsed.results);
      } catch {
        // Invalid JSON, ignore
      }
    }
  }, []);

  // Save to localStorage when state changes
  useEffect(() => {
    const state: StoredState = { stockCodes, results };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [stockCodes, results]);

  /**
   * Normalize input to handle various separator formats
   * Accepts: ; or newline as separators
   * Also handles variations in the code format:
   * - "01-ABCDEF"
   * - "01 - ABCDEF"
   * - "01:ABCDEF"
   */
  const parseInput = (input: string): string[] => {
    return input
      .split(/[;\n]/)
      .map((code) => {
        // Normalize separator variations
        let normalized = code.trim();
        // Replace " - " or ":" with "-"
        normalized = normalized.replace(/\s*[-:]\s*/g, "-");
        return normalized;
      })
      .filter((code) => code.length > 0);
  };

  const handleDecode = async () => {
    setErrors([]);
    setResults([]);

    const codes = parseInput(stockCodes);

    if (codes.length === 0) {
      setErrors([{ input: "", error: "Inserisci almeno un codice magazzino" }]);
      return;
    }

    setIsLoading(true);

    const newResults: ExtendedDecodeResult[] = [];
    const newErrors: BulkError[] = [];

    for (const code of codes) {
      try {
        const decoded = await decodeStockCode(code);
        newResults.push({
          ...decoded,
          stockCode: code.toUpperCase(),
        });
      } catch (err) {
        newErrors.push({
          input: code,
          error: err instanceof Error ? err.message : "Errore durante la decodifica",
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
          type: "decodifica",
          input: stockCodes,
          results: newResults,
          errors: newErrors.length > 0 ? newErrors : undefined,
        });
      }
    }

    setIsLoading(false);
  };

  const handleCopy = async (text: string, index: number) => {
    await navigator.clipboard.writeText(text);
    setCopied(index);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleCopyAll = async () => {
    const text = results.map((r) => r.producerCode).join("\n");
    await navigator.clipboard.writeText(text);
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2000);
  };

  const handleRemoveRow = (index: number) => {
    setResults((prev) => prev.filter((_, i) => i !== index));
  };

  const handleClearResults = () => {
    setResults([]);
    setErrors([]);
  };

  const handleReset = () => {
    setStockCodes("");
    setResults([]);
    setErrors([]);
    localStorage.removeItem(STORAGE_KEY);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && e.ctrlKey) {
      handleDecode();
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Decodifica Codici Magazzino</CardTitle>
        <CardDescription>
          Recupera i codici produttore originali da uno o più codici magazzino
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <Field>
          <FieldLabel htmlFor="stock-codes">Codici Magazzino</FieldLabel>
          <Textarea
            id="stock-codes"
            placeholder="01-ABCDEFG123&#10;02-HIJKLMN456&#10;03-OPQRSTU789"
            value={stockCodes}
            onChange={(e) => setStockCodes(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={4}
          />
          <p className="text-sm text-muted-foreground">
            Inserisci uno o più codici separati da punto e virgola (;) o su righe separate.
            Formati accettati: 01-ABC, 01 - ABC, 01:ABC
          </p>
        </Field>

        <div className="flex gap-3">
          <Button onClick={handleDecode} disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Decodifica
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

        {results.length === 0 ? (
          <Empty>
            <EmptyMedia variant="icon">
              <FileSearch className="h-8 w-8" />
            </EmptyMedia>
            <EmptyTitle>Nessun risultato</EmptyTitle>
            <EmptyDescription>
              I codici produttore appariranno qui dopo la decodifica
            </EmptyDescription>
          </Empty>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">
                Risultati <Badge variant="secondary">{results.length}</Badge>
              </h3>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleCopyAll}>
                  {copiedAll ? (
                    <Check className="mr-2 h-4 w-4" />
                  ) : (
                    <Copy className="mr-2 h-4 w-4" />
                  )}
                  {copiedAll ? "Copiato!" : "Copia tutti"}
                </Button>
                <Button variant="outline" size="sm" onClick={handleClearResults}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Pulisci
                </Button>
              </div>
            </div>

            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[80px]">Categoria</TableHead>
                    <TableHead>Nome Categoria</TableHead>
                    <TableHead>Codice Magazzino</TableHead>
                    <TableHead>Codice Produttore</TableHead>
                    <TableHead className="w-[80px] text-right">Azioni</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {results.map((result, index) => (
                    <TableRow key={index}>
                      <TableCell>
                        <Badge variant="outline">{result.categoryCode}</Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {result.categoryName}
                      </TableCell>
                      <TableCell className="font-mono text-muted-foreground">
                        {result.stockCode}
                      </TableCell>
                      <TableCell className="font-mono font-semibold">
                        {result.producerCode}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => handleCopy(result.producerCode, index)}
                            >
                              {copied === index ? (
                                <Check className="mr-2 h-4 w-4" />
                              ) : (
                                <Copy className="mr-2 h-4 w-4" />
                              )}
                              Copia codice produttore
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => handleRemoveRow(index)}
                              className="text-destructive"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Rimuovi
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
