import * as XLSX from "xlsx";
import { normalizeCode, isValidCode, parseCrossReferences } from "./normalizeCode";
import type {
  ParsedExcelRow,
  ReferenceGroup,
  CodeIndex,
  CodeIndexEntry,
  ImportSummaryData,
} from "@/types/codici";

const REQUIRED_COLUMNS = ["Codici MAV", "CODICE INTERNO", "CROSS REFERENCE"] as const;

export interface ParseExcelResult {
  groups: ReferenceGroup[];
  codeIndex: CodeIndex;
  summary: ImportSummaryData;
  error?: string;
}

function generateId(): string {
  return crypto.randomUUID();
}

export function parseExcelBuffer(buffer: ArrayBuffer): ParseExcelResult {
  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(buffer, { type: "array", raw: false });
  } catch {
    return emptyResult("Impossibile leggere il file. Assicurati che sia un file Excel valido (.xlsx o .xls).");
  }

  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    return emptyResult("Il file Excel non contiene fogli.");
  }

  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
    raw: false,
  });

  if (rows.length === 0) {
    return emptyResult("Il foglio Excel è vuoto.");
  }

  // Validate columns
  const firstRow = rows[0];
  for (const col of REQUIRED_COLUMNS) {
    if (!(col in firstRow)) {
      return emptyResult(
        `Colonna mancante: "${col}". Il file deve contenere esattamente le colonne: ${REQUIRED_COLUMNS.join(", ")}.`
      );
    }
  }

  const now = Date.now();
  const groups: ReferenceGroup[] = [];
  // normalized code -> list of group entries
  const codeIndex: CodeIndex = {};
  // normalized code -> count of groups it appears in (for ambiguity detection)
  const codeGroupCount: Record<string, Set<string>> = {};

  let duplicatiIgnorati = 0;
  let codiciTotali = 0;

  for (const row of rows) {
    const codiceMav = normalizeCode(row["Codici MAV"]);
    const nostroCodice = normalizeCode(row["CODICE INTERNO"]);
    const crossRefs = parseCrossReferences(row["CROSS REFERENCE"]);

    // Skip completely empty rows
    if (!isValidCode(codiceMav) && !isValidCode(nostroCodice) && crossRefs.length === 0) {
      continue;
    }

    const id = generateId();
    const allCodesSet = new Set<string>();

    if (isValidCode(nostroCodice)) allCodesSet.add(nostroCodice);
    if (isValidCode(codiceMav)) allCodesSet.add(codiceMav);
    for (const cr of crossRefs) allCodesSet.add(cr);

    const allCodes = Array.from(allCodesSet);

    const group: ReferenceGroup = {
      id,
      nostroCodice,
      codiceMav,
      crossReferences: crossRefs,
      allCodes,
      createdAt: now,
      updatedAt: now,
    };

    groups.push(group);

    // Index each code
    const addToIndex = (code: string, type: CodeIndexEntry["type"]) => {
      if (!isValidCode(code)) return;

      if (!codeIndex[code]) {
        codeIndex[code] = [];
        codeGroupCount[code] = new Set();
      }

      // Check if this code is already indexed for this group (dedup within group)
      const alreadyInGroup = codeIndex[code].some((e) => e.groupId === id);
      if (alreadyInGroup) {
        duplicatiIgnorati++;
        return;
      }

      codeIndex[code].push({ groupId: id, type });
      codeGroupCount[code].add(id);
      codiciTotali++;
    };

    addToIndex(nostroCodice, "codice_interno");
    addToIndex(codiceMav, "codice_mav");
    for (const cr of crossRefs) {
      addToIndex(cr, "cross_reference");
    }
  }

  const codiciAmbigui = Object.entries(codeGroupCount)
    .filter(([, groupIds]) => groupIds.size > 1)
    .map(([code]) => code);

  const summary: ImportSummaryData = {
    righeLettte: rows.length,
    gruppiCreati: groups.length,
    codiciTotali,
    duplicatiIgnorati,
    codiciAmbigui,
  };

  return { groups, codeIndex, summary };
}

export interface ParseExcelRowsResult {
  rows: ParsedExcelRow[];
  error?: string;
}

export function parseExcelToRows(buffer: ArrayBuffer): ParseExcelRowsResult {
  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(buffer, { type: "array", raw: false });
  } catch {
    return { rows: [], error: "Impossibile leggere il file. Assicurati che sia un file Excel valido (.xlsx o .xls)." };
  }

  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return { rows: [], error: "Il file Excel non contiene fogli." };

  const sheet = workbook.Sheets[sheetName];
  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "", raw: false });

  if (rawRows.length === 0) return { rows: [], error: "Il foglio Excel è vuoto." };

  const firstRow = rawRows[0];
  for (const col of REQUIRED_COLUMNS) {
    if (!(col in firstRow)) {
      return { rows: [], error: `Colonna mancante: "${col}". Il file deve contenere: ${REQUIRED_COLUMNS.join(", ")}.` };
    }
  }

  const rows: ParsedExcelRow[] = rawRows
    .map((row) => ({
      codiceMav: String(row["Codici MAV"] ?? "").trim(),
      nostroCodice: String(row["CODICE INTERNO"] ?? "").trim(),
      crossReference: String(row["CROSS REFERENCE"] ?? "").trim(),
    }))
    .filter((row) => row.codiceMav || row.nostroCodice || row.crossReference);

  return { rows };
}

function emptyResult(error: string): ParseExcelResult {
  return {
    groups: [],
    codeIndex: {},
    summary: { righeLettte: 0, gruppiCreati: 0, codiciTotali: 0, duplicatiIgnorati: 0, codiciAmbigui: [] },
    error,
  };
}
