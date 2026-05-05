export interface ReferenceGroup {
  id: string;
  nostroCodice: string;
  codiceMav: string;
  crossReferences: string[];
  allCodes: string[];
  createdAt: number;
  updatedAt: number;
}

export type CodeType = "codice_interno" | "codice_mav" | "cross_reference";

export interface CodeIndexEntry {
  groupId: string;
  type: CodeType;
}

// code (normalized) -> list of group entries (can appear in multiple groups)
export type CodeIndex = Record<string, CodeIndexEntry[]>;

export interface ParsedExcelRow {
  codiceMav: string;
  nostroCodice: string;
  crossReference: string;
}

export interface ImportSummaryData {
  righeLettte: number;
  gruppiCreati: number;
  codiciTotali: number;
  duplicatiIgnorati: number;
  codiciAmbigui: string[];
}

export interface SearchResult {
  group: ReferenceGroup;
  matchedCode: string;
  matchedType: CodeType;
}

export type PreviewStatus = "new" | "updated" | "unchanged";

export interface PreviewRow {
  id: string;
  nostroCodice: string;
  codiceMav: string;
  crossRef: string;        // raw editable string
  selected: boolean;
  status: PreviewStatus;
  existingGroupId?: string;
  newCrossRefs: string[];  // only the refs being added (for 'updated')
  removedCrossRefs: string[]; // refs being removed (for 'updated')
  oldCodiceMav?: string;   // old MAV value if changing (for 'updated')
}

export interface MergeResultData {
  nuovi: number;
  aggiornati: number;
  saltati: number;
  nuoviCrossRef: number;
}
