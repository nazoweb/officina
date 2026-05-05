"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import type { PreviewRow, PreviewStatus } from "@/types/codici";
import { Plus, Minus, Equal } from "lucide-react";

interface Props {
  rows: PreviewRow[];
  onConfirm: (rows: PreviewRow[]) => void;
  onCancel: () => void;
}

const STATUS_CONFIG: Record<PreviewStatus, { label: string; className: string; icon: React.ElementType }> = {
  new:       { label: "Nuovo",       className: "bg-green-100 text-green-800 dark:bg-green-950/40 dark:text-green-400 border-green-200 dark:border-green-900",  icon: Plus },
  updated:   { label: "Aggiornato", className: "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400 border-amber-200 dark:border-amber-900",   icon: Minus },
  unchanged: { label: "Presente",   className: "bg-muted text-muted-foreground border-border", icon: Equal },
};

type FilterTab = "all" | PreviewStatus;

export function ImportPreviewTable({ rows: initialRows, onConfirm, onCancel }: Props) {
  const [rows, setRows] = useState<PreviewRow[]>(initialRows);
  const [filter, setFilter] = useState<FilterTab>("all");

  const updateRow = (id: string, field: keyof Pick<PreviewRow, "nostroCodice" | "codiceMav" | "crossRef" | "selected">, value: string | boolean) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  };

  const toggleAll = (selected: boolean) => {
    setRows((prev) =>
      prev.map((r) => (r.status !== "unchanged" ? { ...r, selected } : r))
    );
  };

  const counts = {
    all: rows.length,
    new: rows.filter((r) => r.status === "new").length,
    updated: rows.filter((r) => r.status === "updated").length,
    unchanged: rows.filter((r) => r.status === "unchanged").length,
  };
  const selectedCount = rows.filter((r) => r.selected).length;
  const visibleRows = filter === "all" ? rows : rows.filter((r) => r.status === filter);

  const tabs: { key: FilterTab; label: string; count: number }[] = [
    { key: "all",       label: "Tutti",          count: counts.all },
    { key: "new",       label: "Nuovi",          count: counts.new },
    { key: "updated",   label: "Aggiornamenti",  count: counts.updated },
    { key: "unchanged", label: "Già presenti",   count: counts.unchanged },
  ];

  return (
    <div className="space-y-4">
      {/* Action buttons */}
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {selectedCount === 0
            ? "Nessuna riga selezionata"
            : `${selectedCount} ${selectedCount === 1 ? "riga selezionata" : "righe selezionate"}`}
        </p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onCancel}>Annulla</Button>
          <Button onClick={() => onConfirm(rows)} disabled={selectedCount === 0}>
            Importa {selectedCount > 0 ? `${selectedCount} ${selectedCount === 1 ? "prodotto" : "prodotti"}` : ""}
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 flex-wrap">
        {tabs.map(({ key, label, count }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              filter === key
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            {label}
            <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full font-mono ${
              filter === key ? "bg-background/20" : "bg-muted"
            }`}>
              {count}
            </span>
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-lg border overflow-hidden">
        {/* Header */}
        <div className="grid grid-cols-[2rem_8rem_1fr_1fr_1.4fr] bg-muted/50 border-b text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <div className="flex items-center justify-center py-2.5">
            <Checkbox
              checked={rows.filter((r) => r.status !== "unchanged").every((r) => r.selected)}
              onCheckedChange={(v) => toggleAll(!!v)}
            />
          </div>
          <div className="px-3 py-2.5">Stato</div>
          <div className="px-3 py-2.5 border-l">Codice interno</div>
          <div className="px-3 py-2.5 border-l">Codice MAV</div>
          <div className="px-3 py-2.5 border-l">Cross Reference</div>
        </div>

        {/* Rows */}
        {visibleRows.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">Nessuna riga in questa categoria.</div>
        ) : (
          visibleRows.map((row) => {
            const cfg = STATUS_CONFIG[row.status];
            const StatusIcon = cfg.icon;
            const isUnchanged = row.status === "unchanged";

            return (
              <div
                key={row.id}
                className={`grid grid-cols-[2rem_8rem_1fr_1fr_1.4fr] divide-x border-t first:border-t-0 transition-colors ${
                  isUnchanged ? "opacity-50" : "hover:bg-muted/20"
                }`}
              >
                {/* Checkbox */}
                <div className="flex items-center justify-center">
                  <Checkbox
                    checked={row.selected}
                    disabled={isUnchanged}
                    onCheckedChange={(v) => updateRow(row.id, "selected", !!v)}
                  />
                </div>

                {/* Status badge */}
                <div className="px-3 py-2.5 flex items-start pt-3 min-w-0 overflow-hidden">
                  <Badge variant="outline" className={`gap-1 text-xs font-medium truncate ${cfg.className}`}>
                    <StatusIcon className="h-3 w-3 shrink-0" />
                    {cfg.label}
                  </Badge>
                </div>

                {/* Codice interno */}
                <div className="px-2 py-2">
                  <Input
                    value={row.nostroCodice}
                    onChange={(e) => updateRow(row.id, "nostroCodice", e.target.value)}
                    disabled={isUnchanged}
                    className="font-mono text-sm border-0 shadow-none focus-visible:ring-0 px-1 h-8 disabled:opacity-100 disabled:cursor-default"
                  />
                </div>

                {/* Codice MAV */}
                <div className="px-2 py-2">
                  <Input
                    value={row.codiceMav}
                    onChange={(e) => updateRow(row.id, "codiceMav", e.target.value)}
                    disabled={isUnchanged}
                    className="font-mono text-sm border-0 shadow-none focus-visible:ring-0 px-1 h-8 disabled:opacity-100 disabled:cursor-default"
                  />
                </div>

                {/* Cross Reference */}
                <div className="px-2 py-2 space-y-1">
                  <Textarea
                    value={row.crossRef}
                    onChange={(e) => updateRow(row.id, "crossRef", e.target.value)}
                    disabled={isUnchanged}
                    rows={1}
                    className="font-mono text-sm border-0 shadow-none focus-visible:ring-0 px-1 resize-none min-h-0 h-8 leading-8 py-0 disabled:opacity-100 disabled:cursor-default"
                  />
                  {/* Highlight removed cross refs for updated rows */}
                  {row.status === "updated" && row.removedCrossRefs.length > 0 && (
                    <div className="flex flex-wrap gap-1 pb-1">
                      {row.removedCrossRefs.map((r) => (
                        <span key={r} className="inline-flex items-center gap-0.5 text-xs font-mono px-1.5 py-0.5 rounded bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-400 line-through">
                          <Minus className="h-2.5 w-2.5" />
                          {r}
                        </span>
                      ))}
                    </div>
                  )}
                  {/* Highlight new cross refs for updated rows */}
                  {row.status === "updated" && row.newCrossRefs.length > 0 && (
                    <div className="flex flex-wrap gap-1 pb-1">
                      {row.newCrossRefs.map((r) => (
                        <span key={r} className="inline-flex items-center gap-0.5 text-xs font-mono px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400">
                          <Plus className="h-2.5 w-2.5" />
                          {r}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
