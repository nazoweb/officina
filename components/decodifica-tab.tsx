"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Field, FieldLabel } from "@/components/ui/field";
import { decodeStockCode, type DecodeResult } from "@/lib/coding";
import { Copy, Check, AlertCircle, Loader2 } from "lucide-react";

const STORAGE_KEY = "decodifica-tab-state";

interface StoredState {
  stockCode: string;
  result: DecodeResult | null;
}

export function DecodificaTab() {
  const [stockCode, setStockCode] = useState("");
  const [result, setResult] = useState<DecodeResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  // Load from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed: StoredState = JSON.parse(stored);
        setStockCode(parsed.stockCode);
        setResult(parsed.result);
      } catch {
        // Invalid JSON, ignore
      }
    }
  }, []);

  // Save to localStorage when state changes
  useEffect(() => {
    const state: StoredState = { stockCode, result };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [stockCode, result]);

  const handleDecode = async () => {
    setError(null);
    setResult(null);

    if (!stockCode.trim()) {
      setError("Inserisci un codice magazzino");
      return;
    }

    setIsLoading(true);

    try {
      const decoded = await decodeStockCode(stockCode);
      setResult(decoded);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore durante la decodifica");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = async (text: string, field: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(field);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleReset = () => {
    setStockCode("");
    setResult(null);
    setError(null);
    localStorage.removeItem(STORAGE_KEY);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleDecode();
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Decodifica Codici Magazzino</CardTitle>
        <CardDescription>
          Recupera il codice produttore originale da un codice magazzino
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <Field>
          <FieldLabel htmlFor="stock-code">Codice Magazzino</FieldLabel>
          <Input
            id="stock-code"
            placeholder="01-ABCDEFG123"
            value={stockCode}
            onChange={(e) => setStockCode(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <p className="text-sm text-muted-foreground">
            Inserisci il codice magazzino nel formato CATEGORIA-TOKEN
          </p>
        </Field>

        <div className="flex gap-3">
          <Button onClick={handleDecode} disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Decodifica
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

        {result && (
          <>
            <Separator />
            <div className="space-y-4">
              <h3 className="font-semibold">Risultato</h3>

              <div className="rounded-lg border bg-muted/50 p-4">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Categoria</p>
                      <p className="font-medium">
                        <Badge variant="outline" className="mr-2">
                          {result.categoryCode}
                        </Badge>
                        {result.categoryName}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleCopy(result.categoryCode, "category")}
                    >
                      {copied === "category" ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>

                  <Separator />

                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Codice Produttore</p>
                      <p className="font-mono text-lg font-semibold">{result.producerCode}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleCopy(result.producerCode, "producer")}
                    >
                      {copied === "producer" ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
