"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Empty, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty";
import { Field, FieldLabel, FieldGroup } from "@/components/ui/field";
import {
  getHistory,
  deleteHistoryEntry,
  clearHistory,
  formatDateTimeDisplay,
  getHistoryTypeLabel,
  type HistoryEntry,
  type HistoryType,
} from "@/lib/storage";
import { exportRowsToCsv, type CsvRow } from "@/lib/csv";
import { getSettings } from "@/lib/storage";
import type { EncodeResult, DecodeResult } from "@/types";
import {
  Search,
  MoreHorizontal,
  Copy,
  Check,
  Trash2,
  RefreshCw,
  Download,
  History,
  Eye,
} from "lucide-react";

interface StoricoTabProps {
  onRerun?: (entry: HistoryEntry) => void;
}

export function StoricoTab({ onRerun }: StoricoTabProps) {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<HistoryType | "all">("all");
  const [selectedEntry, setSelectedEntry] = useState<HistoryEntry | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  // Load history on mount and when it changes
  const loadHistory = () => {
    setHistory(getHistory());
  };

  useEffect(() => {
    loadHistory();
    
    // Listen for storage changes from other tabs
    const handleStorage = (e: StorageEvent) => {
      if (e.key === "warehouse-codes-history") {
        loadHistory();
      }
    };
    
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  // Filter and sort history
  const filteredHistory = useMemo(() => {
    return history
      .filter((entry) => {
        // Type filter
        if (typeFilter !== "all" && entry.type !== typeFilter) {
          return false;
        }
        
        // Search filter
        if (searchQuery) {
          const query = searchQuery.toLowerCase();
          const inputMatch = entry.input.toLowerCase().includes(query);
          const resultsMatch = entry.results.some((r) => {
            if ("stockCode" in r) {
              return (
                r.stockCode.toLowerCase().includes(query) ||
                r.producerCode.toLowerCase().includes(query)
              );
            }
            return r.producerCode.toLowerCase().includes(query);
          });
          return inputMatch || resultsMatch;
        }
        
        return true;
      })
      .sort((a, b) => b.timestamp - a.timestamp); // Most recent first
  }, [history, searchQuery, typeFilter]);

  const handleDelete = (id: string) => {
    deleteHistoryEntry(id);
    loadHistory();
    if (selectedEntry?.id === id) {
      setSelectedEntry(null);
    }
  };

  const handleClearAll = () => {
    clearHistory();
    loadHistory();
    setSelectedEntry(null);
  };

  const handleCopyResults = async (entry: HistoryEntry) => {
    const results = entry.results as (EncodeResult | DecodeResult)[];
    const text = results
      .map((r) => {
        if ("stockCode" in r) {
          return (r as EncodeResult).stockCode;
        }
        return r.producerCode;
      })
      .join("\n");
    
    await navigator.clipboard.writeText(text);
    setCopied(entry.id);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleExportEntry = (entry: HistoryEntry) => {
    const settings = getSettings();
    const rows: CsvRow[] = (entry.results as EncodeResult[])
      .filter((r): r is EncodeResult => "stockCode" in r)
      .map((r) => ({
        categoria: r.categoryCode,
        nome_categoria: r.categoryName,
        codice_produttore: r.producerCode,
        codice_magazzino: r.stockCode,
      }));
    
    if (rows.length > 0) {
      exportRowsToCsv(rows, settings.csvFilenamePrefix);
    }
  };

  const handleExportAll = () => {
    const settings = getSettings();
    const allRows: CsvRow[] = history.flatMap((entry) =>
      (entry.results as EncodeResult[])
        .filter((r): r is EncodeResult => "stockCode" in r)
        .map((r) => ({
          categoria: r.categoryCode,
          nome_categoria: r.categoryName,
          codice_produttore: r.producerCode,
          codice_magazzino: r.stockCode,
        }))
    );
    
    if (allRows.length > 0) {
      exportRowsToCsv(allRows, `${settings.csvFilenamePrefix}_storico`);
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Storico Operazioni</CardTitle>
          <CardDescription>
            Visualizza e gestisci lo storico delle operazioni di codifica e decodifica
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <FieldGroup className="flex flex-col gap-4 sm:flex-row">
            <Field className="flex-1">
              <FieldLabel htmlFor="search" className="sr-only">
                Cerca
              </FieldLabel>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="Cerca per codice..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </Field>
            
            <Field className="w-full sm:w-48">
              <FieldLabel htmlFor="type-filter" className="sr-only">
                Filtra per tipo
              </FieldLabel>
              <Select
                value={typeFilter}
                onValueChange={(v) => setTypeFilter(v as HistoryType | "all")}
              >
                <SelectTrigger id="type-filter">
                  <SelectValue placeholder="Tutti i tipi" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tutti i tipi</SelectItem>
                  <SelectItem value="codifica">Codifica</SelectItem>
                  <SelectItem value="decodifica">Decodifica</SelectItem>
                  <SelectItem value="multiplo">Inserimento Multiplo</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </FieldGroup>

          {filteredHistory.length > 0 && (
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={handleExportAll}>
                <Download className="mr-2 h-4 w-4" />
                Esporta tutto
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Trash2 className="mr-2 h-4 w-4" />
                    Elimina tutto
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Elimina tutto lo storico?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Questa azione non può essere annullata. Tutti i dati dello storico
                      verranno eliminati permanentemente.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Annulla</AlertDialogCancel>
                    <AlertDialogAction onClick={handleClearAll}>
                      Elimina tutto
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          )}

          {filteredHistory.length === 0 ? (
            <Empty>
              <EmptyMedia variant="icon">
                <History className="h-8 w-8" />
              </EmptyMedia>
              <EmptyTitle>Nessun dato nello storico</EmptyTitle>
              <EmptyDescription>
                {searchQuery || typeFilter !== "all"
                  ? "Nessun risultato trovato con i filtri applicati"
                  : "Le operazioni di codifica e decodifica appariranno qui"}
              </EmptyDescription>
            </Empty>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data/Ora</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead className="text-right">Risultati</TableHead>
                    <TableHead className="w-[80px] text-right">Azioni</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredHistory.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell className="font-medium">
                        {formatDateTimeDisplay(entry.timestamp)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {getHistoryTypeLabel(entry.type)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {entry.results.length}
                        {entry.errors && entry.errors.length > 0 && (
                          <span className="ml-1 text-destructive">
                            ({entry.errors.length} errori)
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setSelectedEntry(entry)}>
                              <Eye className="mr-2 h-4 w-4" />
                              Visualizza
                            </DropdownMenuItem>
                            {onRerun && (
                              <DropdownMenuItem onClick={() => onRerun(entry)}>
                                <RefreshCw className="mr-2 h-4 w-4" />
                                Riesegui
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem onClick={() => handleCopyResults(entry)}>
                              {copied === entry.id ? (
                                <Check className="mr-2 h-4 w-4" />
                              ) : (
                                <Copy className="mr-2 h-4 w-4" />
                              )}
                              Copia risultati
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleExportEntry(entry)}>
                              <Download className="mr-2 h-4 w-4" />
                              Esporta CSV
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => handleDelete(entry.id)}
                              className="text-destructive"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Elimina
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={!!selectedEntry} onOpenChange={() => setSelectedEntry(null)}>
        <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              Dettagli Operazione - {selectedEntry && getHistoryTypeLabel(selectedEntry.type)}
            </DialogTitle>
            <DialogDescription>
              {selectedEntry && formatDateTimeDisplay(selectedEntry.timestamp)}
            </DialogDescription>
          </DialogHeader>
          
          {selectedEntry && (
            <div className="space-y-4">
              <div>
                <h4 className="mb-2 text-sm font-medium text-muted-foreground">Input</h4>
                <pre className="rounded-md bg-muted p-3 text-sm overflow-x-auto">
                  {selectedEntry.input}
                </pre>
              </div>
              
              <div>
                <h4 className="mb-2 text-sm font-medium text-muted-foreground">
                  Risultati ({selectedEntry.results.length})
                </h4>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Categoria</TableHead>
                        <TableHead>Codice Produttore</TableHead>
                        <TableHead>Codice Magazzino</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedEntry.results.map((result, index) => (
                        <TableRow key={index}>
                          <TableCell>
                            <Badge variant="outline">{result.categoryCode}</Badge>
                          </TableCell>
                          <TableCell className="font-mono">
                            {result.producerCode}
                          </TableCell>
                          <TableCell className="font-mono font-semibold">
                            {"stockCode" in result ? (result as EncodeResult).stockCode : "-"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
              
              {selectedEntry.errors && selectedEntry.errors.length > 0 && (
                <div>
                  <h4 className="mb-2 text-sm font-medium text-destructive">
                    Errori ({selectedEntry.errors.length})
                  </h4>
                  <ul className="space-y-1 text-sm">
                    {selectedEntry.errors.map((err, index) => (
                      <li key={index} className="text-destructive">
                        <code className="mr-1">{err.input}</code>: {err.error}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
