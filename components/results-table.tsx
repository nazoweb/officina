"use client";

import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Empty, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty";
import { exportRowsToCsv, type CsvRow, type CopyFormat, formatResultsForCopy } from "@/lib/csv";
import { getSettings } from "@/lib/storage";
import type { EncodeResult, DecodeResult } from "@/types";
import {
  Copy,
  Download,
  Check,
  Trash2,
  MoreHorizontal,
  ChevronDown,
  FileSpreadsheet,
} from "lucide-react";

interface ResultsTableProps {
  results: (EncodeResult | DecodeResult)[];
  onRemoveRow?: (index: number) => void;
  onClearAll?: () => void;
  showProducerCode?: boolean;
  emptyMessage?: string;
}

function isEncodeResult(result: EncodeResult | DecodeResult): result is EncodeResult {
  return "stockCode" in result && result.stockCode !== undefined;
}

export function ResultsTable({
  results,
  onRemoveRow,
  onClearAll,
  showProducerCode = true,
  emptyMessage = "Nessun risultato",
}: ResultsTableProps) {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [copiedAll, setCopiedAll] = useState<CopyFormat | null>(null);

  const handleCopyRow = async (code: string, index: number) => {
    await navigator.clipboard.writeText(code);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handleCopyAll = async (format: CopyFormat) => {
    const rows: CsvRow[] = results
      .filter(isEncodeResult)
      .map((r) => ({
        categoria: r.categoryCode,
        nome_categoria: r.categoryName,
        codice_produttore: r.producerCode,
        codice_magazzino: r.stockCode,
      }));

    const text = formatResultsForCopy(rows, format);
    await navigator.clipboard.writeText(text);
    setCopiedAll(format);
    setTimeout(() => setCopiedAll(null), 2000);
  };

  const handleExportCsv = () => {
    const settings = getSettings();
    const rows: CsvRow[] = results
      .filter(isEncodeResult)
      .map((r) => ({
        categoria: r.categoryCode,
        nome_categoria: r.categoryName,
        codice_produttore: r.producerCode,
        codice_magazzino: r.stockCode,
      }));
    exportRowsToCsv(rows, settings.csvFilenamePrefix);
  };

  if (results.length === 0) {
    return (
      <Empty>
        <EmptyMedia variant="icon">
          <FileSpreadsheet className="h-8 w-8" />
        </EmptyMedia>
        <EmptyTitle>{emptyMessage}</EmptyTitle>
        <EmptyDescription>
          I risultati appariranno qui dopo l&apos;elaborazione
        </EmptyDescription>
      </Empty>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">
          Risultati <Badge variant="secondary">{results.length}</Badge>
        </h3>
        <div className="flex gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                {copiedAll ? (
                  <Check className="mr-2 h-4 w-4" />
                ) : (
                  <Copy className="mr-2 h-4 w-4" />
                )}
                {copiedAll ? "Copiato!" : "Copia"}
                <ChevronDown className="ml-2 h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleCopyAll("codes-only")}>
                Solo codici magazzino
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleCopyAll("full")}>
                Tutti i dati (tabulati)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleCopyAll("excel-column")}>
                Colonna Excel (newline)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button variant="outline" size="sm" onClick={handleExportCsv}>
            <Download className="mr-2 h-4 w-4" />
            Scarica CSV
          </Button>

          {onClearAll && (
            <Button variant="outline" size="sm" onClick={onClearAll}>
              <Trash2 className="mr-2 h-4 w-4" />
              Pulisci
            </Button>
          )}
        </div>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[80px]">Categoria</TableHead>
              <TableHead>Nome Categoria</TableHead>
              {showProducerCode && <TableHead>Codice Produttore</TableHead>}
              <TableHead>Codice Magazzino</TableHead>
              <TableHead className="w-[80px] text-right">Azioni</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {results.map((result, index) => {
              const stockCode = isEncodeResult(result)
                ? result.stockCode
                : (result as DecodeResult).stockCode || "";

              return (
                <TableRow key={index}>
                  <TableCell>
                    <Badge variant="outline">{result.categoryCode}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {result.categoryName}
                  </TableCell>
                  {showProducerCode && (
                    <TableCell className="font-mono">{result.producerCode}</TableCell>
                  )}
                  <TableCell className="font-mono font-semibold">{stockCode}</TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleCopyRow(stockCode, index)}>
                          {copiedIndex === index ? (
                            <Check className="mr-2 h-4 w-4" />
                          ) : (
                            <Copy className="mr-2 h-4 w-4" />
                          )}
                          Copia codice
                        </DropdownMenuItem>
                        {onRemoveRow && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => onRemoveRow(index)}
                              className="text-destructive"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Rimuovi
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
