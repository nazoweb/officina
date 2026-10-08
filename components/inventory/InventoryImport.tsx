"use client";

import { useState } from "react";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { upsertImportedProduct } from "@/lib/inventory/api";
import { getReferenceGroups } from "@/lib/codici/storageReferences";
import { guessImportMapping, importedDraft, importLabels, type ImportField, type ImportMapping } from "@/lib/inventory/import";

export function InventoryImport() {
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [mapping, setMapping] = useState<ImportMapping>({});
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const selectFile = async (file?: File) => {
    if (!file) return;
    setError(""); setMessage(""); setRows([]); setHeaders([]);
    try {
      const book = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const parsed = XLSX.utils.sheet_to_json<Record<string, unknown>>(book.Sheets[book.SheetNames[0]], { defval: "", raw: false });
      const nextHeaders = Object.keys(parsed[0] ?? {});
      if (!nextHeaders.length) throw new Error("Il foglio è vuoto o non contiene intestazioni.");
      setHeaders(nextHeaders); setRows(parsed); setMapping(guessImportMapping(nextHeaders));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Impossibile leggere il file."); }
  };
  const migrateLocalCodes = async () => {
    const groups = getReferenceGroups();
    if (!groups.length) { setError("Non ci sono codici locali da migrare in questo browser."); return; }
    setLoading(true); setError(""); setMessage("");
    try {
      for (const group of groups) await upsertImportedProduct({ internal_code: group.nostroCodice || group.codiceMav || group.crossReferences[0], mav: group.codiceMav, crossReferences: group.crossReferences }, "Migrazione archivio locale");
      setMessage(`Migrati ${groups.length} gruppi di codici locali. Completa nomi, prezzi e giacenze tramite Excel.`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Migrazione interrotta."); }
    finally { setLoading(false); }
  };
  const prepared = rows.map((row, index) => {
    try { return { draft: importedDraft(row, mapping, headers), error: "" }; }
    catch (cause) { return { draft: null, error: `Riga ${index + 2}: ${cause instanceof Error ? cause.message : "Dati non validi."}` }; }
  });
  const validationError = prepared.find((row) => row.error)?.error;
  const runImport = async () => {
    if (!mapping.internal_code) { setError("Scegli la colonna del nostro codice prima di importare."); return; }
    if (validationError) { setError(validationError); return; }
    setLoading(true); setError(""); setMessage("");
    let created = 0; let updated = 0; let skipped = 0;
    try {
      for (const { draft } of prepared) {
        if (!draft) { skipped++; continue; }
        const result = await upsertImportedProduct(draft);
        result.created ? created++ : updated++;
      }
      setMessage(`Importazione conclusa: ${created} nuovi prodotti, ${updated} aggiornati, ${skipped} righe senza codice ignorate.`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Importazione interrotta."); }
    finally { setLoading(false); }
  };
  return <div className="space-y-5">
    <section className="rounded-xl border bg-card p-5">
      <label className="block text-sm font-semibold">File Excel<Input className="mt-3" type="file" accept=".xlsx,.xls" disabled={loading} onChange={(e) => selectFile(e.target.files?.[0])} /></label>
      <p className="mt-2 text-xs text-muted-foreground">Colonne supportate: CODICE FORNITORE, NOSTRO CODICE, CROSS REFERENCE, PREZZO VENDITA, SCONTO AZIENDE, SCONTO OFFICINE, QUANTITÀ. Viene letto il primo foglio. Il barcode viene generato dal nostro codice; la colonna CODICE A BARRE dell’Excel viene ignorata.</p>
    </section>
    <section className="rounded-xl border border-dashed bg-muted/20 p-5">
      <h2 className="font-semibold">Migra archivio precedente</h2>
      <p className="mt-1 text-sm text-muted-foreground">Trasferisce i codici già salvati in questo browser senza cancellare le informazioni dei prodotti già presenti.</p>
      <Button variant="outline" className="mt-3" onClick={migrateLocalCodes} disabled={loading}>Migra codici locali</Button>
    </section>
    {headers.length > 0 && <>
      <section className="rounded-xl border bg-card p-5">
        <h2 className="font-semibold">Mappa colonne</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">{(Object.keys(importLabels) as ImportField[]).map((field) => <label key={field} className="text-sm font-medium">{importLabels[field]}<select disabled={loading} className="mt-1.5 h-9 w-full rounded-md border bg-background px-3 text-sm" value={mapping[field] || ""} onChange={(e) => setMapping({ ...mapping, [field]: e.target.value })}><option value="">— Non presente —</option>{headers.map((header) => <option value={header} key={header}>{header}</option>)}</select></label>)}</div>
        <p className="mt-4 text-xs text-muted-foreground">Sconto aziende e Sconto officine sono considerati prezzi finali in euro. Le celle prezzo vuote restano senza prezzo. Le colonne non abbinate non cancellano i dati esistenti.</p>
      </section>
      <section className="overflow-hidden rounded-xl border bg-card">
        <div className="p-5"><h2 className="font-semibold">Anteprima · {rows.length} righe</h2><p className="mt-1 text-sm text-muted-foreground">Prime 5 righe. Mantieni i codici come testo nell’Excel; separa i cross-reference con punto e virgola o virgola.</p></div>
        <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-muted/40"><tr>{["Nostro codice", "Codice fornitore", "Cross-reference", "Barcode", "Vendita", "Aziende", "Officine", "Quantità"].map((label) => <th className="whitespace-nowrap px-4 py-3 font-medium" key={label}>{label}</th>)}</tr></thead><tbody>{prepared.slice(0, 5).map(({ draft, error: rowError }, index) => <tr className="border-t" key={index}>{rowError ? <td className="px-4 py-3 text-destructive" colSpan={8}>{rowError}</td> : <>{[draft?.internal_code, draft?.supplierCode, draft?.crossReferences?.join("; "), draft?.barcode, ...["Prezzo vendita", "Sconto aziende", "Sconto officine"].map((name) => { const price = draft?.prices?.find((p) => p.name === name); return price ? new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(price.amount) : undefined; }), draft?.stockQuantity].map((value, cell) => <td className="whitespace-nowrap px-4 py-3" key={cell}>{value ?? "—"}</td>)}</>}</tr>)}</tbody></table></div>
        <div className="p-5"><p className="text-sm text-muted-foreground">La quantità inizializza i prodotti nuovi. Gli aggiornamenti non sovrascrivono la giacenza calcolata; per rettificarla usa Magazzino.</p>{validationError && <p className="mt-2 text-sm text-destructive">{validationError}</p>}<Button className="mt-4" onClick={runImport} disabled={loading || !mapping.internal_code || Boolean(validationError)}>{loading ? "Importazione in corso…" : "Conferma importazione"}</Button></div>
      </section>
    </>}
    {message && <Alert><AlertDescription>{message}</AlertDescription></Alert>}
    {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
  </div>;
}
