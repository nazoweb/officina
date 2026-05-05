"use client";

import { useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getReferenceGroups, deleteGroup } from "@/lib/codici/storageReferences";
import { Search, ChevronLeft, ChevronRight, ArrowUpDown, Trash2 } from "lucide-react";
import type { ReferenceGroup } from "@/types/codici";

const PAGE_SIZE = 50;

type SortKey = "nostroCodice" | "codiceMav";
type SortDir = "asc" | "desc";

export function CodiciTable() {
  const [groups, setGroups] = useState<ReferenceGroup[]>([]);
  const [filter, setFilter] = useState("");
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: "nostroCodice", dir: "asc" });
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    setGroups(getReferenceGroups());
  }, []);

  const filtered = useMemo(() => {
    const q = filter.trim().toUpperCase();
    const base = !q
      ? groups
      : groups.filter(
          (g) =>
            g.nostroCodice.includes(q) ||
            g.codiceMav.includes(q) ||
            g.crossReferences.some((cr) => cr.includes(q))
        );

    return [...base].sort((a, b) => {
      const va = a[sort.key] ?? "";
      const vb = b[sort.key] ?? "";
      return sort.dir === "asc" ? va.localeCompare(vb) : vb.localeCompare(va);
    });
  }, [groups, filter, sort]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleFilterChange = (v: string) => {
    setFilter(v);
    setPage(1);
    setSelectedIds(new Set());
    setConfirmDelete(false);
  };

  const toggleSort = (key: SortKey) => {
    setSort((prev) =>
      prev.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }
    );
    setPage(1);
  };

  const toggleRow = (id: string) => {
    setConfirmDelete(false);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const allPageSelected =
    paginated.length > 0 && paginated.every((g) => selectedIds.has(g.id));
  const somePageSelected = paginated.some((g) => selectedIds.has(g.id));

  const toggleAllPage = () => {
    setConfirmDelete(false);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allPageSelected) paginated.forEach((g) => next.delete(g.id));
      else paginated.forEach((g) => next.add(g.id));
      return next;
    });
  };

  const handleDeleteClick = () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    selectedIds.forEach((id) => deleteGroup(id));
    setGroups(getReferenceGroups());
    setSelectedIds(new Set());
    setConfirmDelete(false);
  };

  const handleDeleteSingle = (id: string) => {
    if (confirmDeleteId !== id) {
      setConfirmDeleteId(id);
      return;
    }
    deleteGroup(id);
    setGroups(getReferenceGroups());
    setConfirmDeleteId(null);
  };

  if (groups.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="rounded-xl border bg-card p-12 text-center">
          <p className="font-medium mb-1">Nessun dato disponibile</p>
          <p className="text-sm text-muted-foreground">Carica un listino per vedere i codici.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100svh-3.5rem)] px-6 py-4 gap-3">

      {/* Title */}
      <div className="shrink-0">
        <h1 className="text-xl font-semibold mb-0.5">Tutti i codici</h1>
        <p className="text-sm text-muted-foreground">
          Elenco completo dei prodotti. Seleziona le righe per eliminarle.
        </p>
      </div>

      {/* Toolbar */}
      <div className="shrink-0 flex items-center gap-3 flex-wrap">
        <div className="relative max-w-xs w-full sm:w-auto sm:flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={filter}
            onChange={(e) => handleFilterChange(e.target.value)}
            placeholder="Filtra codici..."
            className="pl-8 h-9"
          />
        </div>

        <span className="text-sm text-muted-foreground shrink-0">
          {filtered.length.toLocaleString("it-IT")}{" "}
          {filtered.length === 1 ? "prodotto" : "prodotti"}
        </span>

        <div className="ml-auto flex items-center gap-2">
          {selectedIds.size > 0 && (
            <>
              <span className="text-sm text-muted-foreground shrink-0">
                {selectedIds.size} {selectedIds.size === 1 ? "selezionato" : "selezionati"}
              </span>

              {confirmDelete ? (
                <>
                  <Button variant="destructive" size="sm" onClick={handleDeleteClick}>
                    <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                    Conferma eliminazione
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setConfirmDelete(false)}
                  >
                    Annulla
                  </Button>
                </>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30"
                  onClick={handleDeleteClick}
                >
                  <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                  Elimina
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Table — scrollable */}
      <div className="flex-1 min-h-0 overflow-y-auto rounded-lg border">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-muted/90 backdrop-blur-sm">
            <TableRow>
              <TableHead className="w-10 px-3">
                <Checkbox
                  checked={allPageSelected ? true : somePageSelected ? "indeterminate" : false}
                  onCheckedChange={toggleAllPage}
                />
              </TableHead>
              <TableHead className="w-[170px]">
                <button
                  onClick={() => toggleSort("nostroCodice")}
                  className="flex items-center gap-1 font-semibold text-foreground hover:text-foreground/70 transition-colors"
                >
                  Codice interno
                  <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              </TableHead>
              <TableHead className="w-[150px]">
                <button
                  onClick={() => toggleSort("codiceMav")}
                  className="flex items-center gap-1 font-semibold text-foreground hover:text-foreground/70 transition-colors"
                >
                  Codice MAV
                  <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              </TableHead>
              <TableHead>Cross Reference</TableHead>
              <TableHead className="w-12 text-center">Azioni</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginated.map((group) => {
              const isSelected = selectedIds.has(group.id);
              const isConfirmingDelete = confirmDeleteId === group.id;
              return (
                <TableRow
                  key={group.id}
                  data-state={isSelected ? "selected" : undefined}
                  className="cursor-pointer hover:bg-muted/40 transition-colors"
                  onClick={() => toggleRow(group.id)}
                >
                  <TableCell className="w-10 px-3 py-3" onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => toggleRow(group.id)}
                    />
                  </TableCell>
                  <TableCell className="font-mono text-sm font-medium py-3">
                    {group.nostroCodice || <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="font-mono text-sm py-3">
                    {group.codiceMav || <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="py-3">
                    <CrossRefCell refs={group.crossReferences} />
                  </TableCell>
                  <TableCell className="w-12 py-3" onClick={(e) => e.stopPropagation()}>
                    {isConfirmingDelete ? (
                      <div className="flex items-center gap-1">
                        <Button
                          variant="destructive"
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={() => handleDeleteSingle(group.id)}
                          title="Conferma eliminazione"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={() => setConfirmDeleteId(null)}
                          title="Annulla"
                        >
                          ✕
                        </Button>
                      </div>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => handleDeleteSingle(group.id)}
                        title="Elimina riga"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="shrink-0 flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Pagina {page} di {totalPages}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              className="h-8 w-8 p-0"
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 w-8 p-0"
              disabled={page === totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function CrossRefCell({ refs }: { refs: string[] }) {
  if (refs.length === 0) return <span className="text-muted-foreground text-sm">—</span>;

  return (
    <div className="flex flex-wrap gap-1">
      {refs.map((ref) => (
        <Badge key={ref} variant="secondary" className="font-mono text-xs font-normal">
          {ref}
        </Badge>
      ))}
    </div>
  );
}
