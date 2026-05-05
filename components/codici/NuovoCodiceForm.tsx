"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { addManualGroup } from "@/lib/codici/storageReferences";
import { parseCrossReferences } from "@/lib/codici/normalizeCode";
import { CheckCircle2, AlertTriangle, Plus, Trash2, RotateCcw } from "lucide-react";
import type { ReferenceGroup } from "@/types/codici";

interface Row {
  id: string;
  nostroCodice: string;
  codiceMav: string;
  crossRef: string;
}

interface SavedRow {
  group: ReferenceGroup;
  conflicts: string[];
}

function emptyRow(): Row {
  return { id: crypto.randomUUID(), nostroCodice: "", codiceMav: "", crossRef: "" };
}

const INITIAL_ROWS = 1;

export function NuovoCodiceForm() {
  const [rows, setRows] = useState<Row[]>(() => Array.from({ length: INITIAL_ROWS }, emptyRow));
  const [saved, setSaved] = useState<SavedRow[] | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const tableEndRef = useRef<HTMLDivElement>(null);

  const updateRow = (id: string, field: keyof Omit<Row, "id">, value: string) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  };

  const deleteRow = (id: string) => {
    if (confirmDeleteId !== id) {
      setConfirmDeleteId(id);
      return;
    }
    setRows((prev) => (prev.length > 1 ? prev.filter((r) => r.id !== id) : prev));
    setConfirmDeleteId(null);
  };

  const addRow = () => {
    setRows((prev) => [...prev, emptyRow()]);
    setTimeout(() => tableEndRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 50);
  };

  const handleKeyDown = (e: React.KeyboardEvent, rowIndex: number, field: keyof Omit<Row, "id">) => {
    if (e.key === "Tab" && !e.shiftKey && field === "crossRef" && rowIndex === rows.length - 1) {
      e.preventDefault();
      addRow();
    }
    if (e.key === "Enter" && field === "crossRef") {
      e.preventDefault();
    }
  };

  const filledRows = rows.filter((r) => r.nostroCodice.trim() || r.codiceMav.trim());

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (filledRows.length === 0) return;

    const results: SavedRow[] = filledRows.map((row) => {
      const refs = parseCrossReferences(row.crossRef);
      return addManualGroup(row.nostroCodice, row.codiceMav, refs);
    });

    setSaved(results);
  };

  const handleReset = () => {
    setRows(Array.from({ length: INITIAL_ROWS }, emptyRow));
    setSaved(null);
  };

  /* ── Result screen ── */
  if (saved) {
    const totalConflicts = saved.flatMap((r) => r.conflicts);
    return (
      <div className="space-y-4">
        {totalConflicts.length === 0 ? (
          <Alert className="border-green-200 bg-green-50 dark:bg-green-950/20 dark:border-green-900">
            <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
            <AlertDescription className="text-green-800 dark:text-green-300 font-medium">
              {saved.length === 1 ? "1 prodotto salvato" : `${saved.length} prodotti salvati`} correttamente.
            </AlertDescription>
          </Alert>
        ) : (
          <Alert className="border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-900">
            <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            <AlertDescription className="text-amber-800 dark:text-amber-300">
              <p className="font-medium mb-1">
                {saved.length === 1 ? "1 prodotto salvato" : `${saved.length} prodotti salvati`} con avvisi.
              </p>
              <p className="text-sm">
                {totalConflicts.length === 1 ? "Il codice" : "I codici"}{" "}
                <span className="font-mono">{totalConflicts.join(", ")}</span>{" "}
                {totalConflicts.length === 1 ? "è già presente" : "sono già presenti"} in altri prodotti.
              </p>
            </AlertDescription>
          </Alert>
        )}

        {/* Riepilogo righe salvate */}
        <div className="rounded-lg border overflow-hidden">
          <div className="grid grid-cols-3 bg-muted/50 border-b text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <div className="px-4 py-2.5 border-r">Codice interno</div>
            <div className="px-4 py-2.5 border-r">Codice MAV</div>
            <div className="px-4 py-2.5">Cross Reference</div>
          </div>
          {saved.map(({ group }) => (
            <div key={group.id} className="grid grid-cols-3 divide-x border-t first:border-t-0 hover:bg-muted/30 transition-colors">
              <div className="px-4 py-2.5 font-mono text-sm">{group.nostroCodice || <span className="text-muted-foreground">—</span>}</div>
              <div className="px-4 py-2.5 font-mono text-sm">{group.codiceMav || <span className="text-muted-foreground">—</span>}</div>
              <div className="px-4 py-2.5 flex flex-wrap gap-1">
                {group.crossReferences.length > 0
                  ? group.crossReferences.map((r) => (
                      <Badge key={r} variant="secondary" className="font-mono text-xs">{r}</Badge>
                    ))
                  : <span className="text-muted-foreground text-sm">—</span>}
              </div>
            </div>
          ))}
        </div>

        <div className="flex gap-2">
          <Button onClick={handleReset} variant="outline" className="flex-1">
            <Plus className="mr-2 h-4 w-4" />
            Inserisci altri
          </Button>
          <Button asChild className="flex-1">
            <Link href="/codici/tabella">Vedi tutti i codici</Link>
          </Button>
        </div>
      </div>
    );
  }

  /* ── Form ── */
  return (
    <form onSubmit={handleSave} className="space-y-4">

      {/* Actions */}
      <div className="flex items-center gap-2 flex-wrap">
        <Button type="button" variant="outline" size="sm" onClick={addRow}>
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          Aggiungi riga
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleReset}
        >
          <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
          Azzera
        </Button>
        <Button type="submit" disabled={filledRows.length === 0} className="ml-auto">
          Salva {filledRows.length > 0 ? `${filledRows.length} ${filledRows.length === 1 ? "codice" : "codici"}` : ""}
        </Button>
      </div>

      <div className="rounded-lg border overflow-hidden">

        {/* Header */}
        <div className="grid grid-cols-[1fr_1fr_1.4fr_2rem] bg-muted/50 border-b text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <div className="px-4 py-2.5 border-r">Codice interno</div>
          <div className="px-4 py-2.5 border-r">Codice MAV</div>
          <div className="px-4 py-2.5">Cross Reference</div>
          <div />
        </div>

        {/* Rows */}
        {rows.map((row, i) => {
          const isConfirmingDelete = confirmDeleteId === row.id;
          return (
            <div
              key={row.id}
              className="grid grid-cols-[1fr_1fr_1.4fr_2rem] divide-x border-t first:border-t-0 group"
            >
              <div className="px-3 py-2">
                <Input
                  value={row.nostroCodice}
                  onChange={(e) => updateRow(row.id, "nostroCodice", e.target.value)}
                  placeholder="Es. 01-0002C"
                  className="font-mono text-sm border-0 shadow-none focus-visible:ring-0 px-0 h-8"
                />
              </div>
              <div className="px-3 py-2">
                <Input
                  value={row.codiceMav}
                  onChange={(e) => updateRow(row.id, "codiceMav", e.target.value)}
                  placeholder="Es. MAV5160A"
                  className="font-mono text-sm border-0 shadow-none focus-visible:ring-0 px-0 h-8"
                />
              </div>
              <div className="px-3 py-2">
                <Textarea
                  value={row.crossRef}
                  onChange={(e) => updateRow(row.id, "crossRef", e.target.value)}
                  onKeyDown={(e) => handleKeyDown(e, i, "crossRef")}
                  placeholder="0001107554; F032US0057"
                  className="font-mono text-sm border-0 shadow-none focus-visible:ring-0 px-0 resize-none min-h-0 h-8 leading-8 py-0"
                  rows={1}
                />
              </div>
              <div className="flex items-center justify-center">
                {isConfirmingDelete ? (
                  <div className="flex items-center gap-0.5">
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={() => deleteRow(row.id)}
                      title="Conferma eliminazione"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={() => setConfirmDeleteId(null)}
                      title="Annulla"
                    >
                      ✕
                    </Button>
                  </div>
                ) : (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={rows.length === 1}
                    className="h-6 w-6 p-0 text-destructive hover:text-destructive hover:bg-destructive/10 disabled:text-muted-foreground disabled:hover:bg-transparent"
                    onClick={() => deleteRow(row.id)}
                    title="Rimuovi riga"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>
          );
        })}

        <div ref={tableEndRef} />
      </div>

      <p className="text-xs text-muted-foreground">
        I cross reference possono essere separati da <span className="font-mono">;</span>, virgola o slash.
      </p>
    </form>
  );
}
