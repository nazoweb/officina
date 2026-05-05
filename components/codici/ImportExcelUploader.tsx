"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ImportPreviewTable } from "./ImportPreviewTable";
import { parseExcelToRows } from "@/lib/codici/parseExcelReferences";
import { buildPreviewRows, applyMerge } from "@/lib/codici/importMerge";
import { getReferenceGroups, getCodeIndex, clearReferenceData } from "@/lib/codici/storageReferences";
import { Upload, FileSpreadsheet, AlertCircle, Trash2, CheckCircle2, RotateCcw } from "lucide-react";
import type { PreviewRow, MergeResultData } from "@/types/codici";

type Phase = "idle" | "loading" | "preview" | "done";

export function ImportExcelUploader() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([]);
  const [mergeResult, setMergeResult] = useState<MergeResultData | null>(null);

  const handleFile = async (file: File) => {
    setError(null);
    setFileName(file.name);
    setPhase("loading");

    try {
      const buffer = await file.arrayBuffer();
      const { rows, error: parseError } = parseExcelToRows(buffer);

      if (parseError) {
        setError(parseError);
        setPhase("idle");
        return;
      }

      const existingGroups = getReferenceGroups();
      const codeIndex = getCodeIndex();
      const preview = buildPreviewRows(rows, existingGroups, codeIndex);

      setPreviewRows(preview);
      setPhase("preview");
    } catch {
      setError("Si è verificato un errore durante la lettura del file. Riprova.");
      setPhase("idle");
    }
  };

  const handleConfirm = (rows: PreviewRow[]) => {
    const result = applyMerge(rows);
    setMergeResult(result);
    setPhase("done");
  };

  const handleReset = () => {
    setPhase("idle");
    setError(null);
    setFileName(null);
    setPreviewRows([]);
    setMergeResult(null);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = "";
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  /* ── Idle ── */
  if (phase === "idle") {
    return (
      <div className="space-y-4">
        <div
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onClick={() => inputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl py-14 px-8 text-center transition-all cursor-pointer select-none ${
            isDragging
              ? "border-primary bg-primary/5"
              : "border-border hover:border-primary/40 hover:bg-muted/20"
          }`}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={handleInputChange}
          />
          <div className="flex flex-col items-center gap-4">
            <div className={`flex h-16 w-16 items-center justify-center rounded-full transition-colors ${isDragging ? "bg-primary/10" : "bg-muted"}`}>
              <FileSpreadsheet className={`h-8 w-8 transition-colors ${isDragging ? "text-primary" : "text-muted-foreground"}`} />
            </div>
            <div className="space-y-1">
              <p className="font-semibold text-base">
                {isDragging ? "Rilascia per caricare" : "Trascina qui il file Excel"}
              </p>
              {!isDragging && (
                <p className="text-sm text-muted-foreground">oppure clicca per sfogliare i file</p>
              )}
            </div>
            {!isDragging && (
              <Button
                variant="outline"
                size="sm"
                type="button"
                onClick={(e) => { e.stopPropagation(); inputRef.current?.click(); }}
              >
                <Upload className="mr-2 h-4 w-4" />
                Scegli file
              </Button>
            )}
          </div>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </div>
    );
  }

  /* ── Loading ── */
  if (phase === "loading") {
    return (
      <div className="space-y-3 py-2">
        <Skeleton className="h-10 w-full rounded-lg" />
        <Skeleton className="h-28 w-full rounded-lg" />
        <Skeleton className="h-28 w-full rounded-lg" />
        <Skeleton className="h-16 w-3/4 rounded-lg" />
      </div>
    );
  }

  /* ── Preview ── */
  if (phase === "preview") {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <FileSpreadsheet className="h-4 w-4 shrink-0" />
          <span className="font-medium text-foreground truncate">{fileName}</span>
          <span className="shrink-0">— {previewRows.length} righe trovate</span>
        </div>

        <ImportPreviewTable
          rows={previewRows}
          onConfirm={handleConfirm}
          onCancel={handleReset}
        />
      </div>
    );
  }

  /* ── Done ── */
  if (phase === "done" && mergeResult) {
    const { nuovi, aggiornati, saltati, nuoviCrossRef } = mergeResult;
    const hadChanges = nuovi > 0 || aggiornati > 0;

    return (
      <div className="space-y-5">
        <Alert className={hadChanges
          ? "border-green-200 bg-green-50 dark:bg-green-950/20 dark:border-green-900"
          : "border-border bg-muted/30"
        }>
          <CheckCircle2 className={`h-4 w-4 ${hadChanges ? "text-green-600 dark:text-green-400" : "text-muted-foreground"}`} />
          <AlertDescription className={hadChanges ? "text-green-800 dark:text-green-300 font-medium" : "text-muted-foreground"}>
            {hadChanges
              ? "Importazione completata con successo."
              : "Nessuna modifica apportata — tutti i dati erano già presenti."}
          </AlertDescription>
        </Alert>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Nuovi prodotti" value={nuovi} color="green" />
          <StatCard label="Aggiornamenti" value={aggiornati} color="amber" />
          <StatCard label="Saltati" value={saltati} color="muted" />
          <StatCard label="Nuovi cross ref" value={nuoviCrossRef} color="blue" />
        </div>

        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <FileSpreadsheet className="h-4 w-4 shrink-0" />
          <span className="font-medium text-foreground truncate">{fileName}</span>
        </div>

        <Separator />

        <div className="flex items-center justify-between gap-3">
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={() => { clearReferenceData(); handleReset(); }}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Elimina tutti i dati
          </Button>
          <Button variant="outline" size="sm" onClick={handleReset}>
            <RotateCcw className="mr-2 h-4 w-4" />
            Carica un altro file
          </Button>
        </div>
      </div>
    );
  }

  return null;
}

function StatCard({ label, value, color }: { label: string; value: number; color: "green" | "amber" | "blue" | "muted" }) {
  const colorMap = {
    green: "text-green-700 dark:text-green-400",
    amber: "text-amber-700 dark:text-amber-400",
    blue:  "text-blue-700 dark:text-blue-400",
    muted: "text-muted-foreground",
  };
  return (
    <div className="rounded-lg border bg-card p-4 space-y-1">
      <p className={`text-2xl font-bold tabular-nums ${colorMap[color]}`}>{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
