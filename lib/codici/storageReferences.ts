import type { ReferenceGroup, CodeIndex, CodeType } from "@/types/codici";
import { normalizeCode, isValidCode } from "./normalizeCode";

const GROUPS_KEY = "reference-groups";
const INDEX_KEY = "reference-code-index";

export function getReferenceGroups(): ReferenceGroup[] {
  if (typeof window === "undefined") return [];
  const stored = localStorage.getItem(GROUPS_KEY);
  if (!stored) return [];
  try {
    return JSON.parse(stored) as ReferenceGroup[];
  } catch {
    return [];
  }
}

export function saveReferenceGroups(groups: ReferenceGroup[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(GROUPS_KEY, JSON.stringify(groups));
}

export function getCodeIndex(): CodeIndex {
  if (typeof window === "undefined") return {};
  const stored = localStorage.getItem(INDEX_KEY);
  if (!stored) return {};
  try {
    return JSON.parse(stored) as CodeIndex;
  } catch {
    return {};
  }
}

export function saveCodeIndex(index: CodeIndex): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(INDEX_KEY, JSON.stringify(index));
}

export function clearReferenceData(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(GROUPS_KEY);
  localStorage.removeItem(INDEX_KEY);
}

export function hasReferenceData(): boolean {
  if (typeof window === "undefined") return false;
  return !!localStorage.getItem(GROUPS_KEY);
}

export function getReferenceStats(): { groups: number; codes: number } {
  const groups = getReferenceGroups();
  const index = getCodeIndex();
  return {
    groups: groups.length,
    codes: Object.keys(index).length,
  };
}

export interface AddGroupResult {
  group: ReferenceGroup;
  conflicts: string[]; // codes that already existed in other groups
}

export function addManualGroup(
  rawNostroCodice: string,
  rawCodiceMav: string,
  rawCrossReferences: string[]
): AddGroupResult {
  const nostroCodice = normalizeCode(rawNostroCodice);
  const codiceMav = normalizeCode(rawCodiceMav);
  const crossReferences = rawCrossReferences.map(normalizeCode).filter(isValidCode);

  const allCodesSet = new Set<string>();
  if (isValidCode(nostroCodice)) allCodesSet.add(nostroCodice);
  if (isValidCode(codiceMav)) allCodesSet.add(codiceMav);
  crossReferences.forEach((c) => allCodesSet.add(c));

  const id = crypto.randomUUID();
  const now = Date.now();
  const group: ReferenceGroup = {
    id,
    nostroCodice,
    codiceMav,
    crossReferences,
    allCodes: Array.from(allCodesSet),
    createdAt: now,
    updatedAt: now,
  };

  const groups = getReferenceGroups();
  const index = getCodeIndex();
  const conflicts: string[] = [];

  const addToIndex = (code: string, type: CodeType) => {
    if (!isValidCode(code)) return;
    if (!index[code]) index[code] = [];
    const alreadyInOtherGroup = index[code].some((e) => e.groupId !== id);
    if (alreadyInOtherGroup) conflicts.push(code);
    const alreadyInThisGroup = index[code].some((e) => e.groupId === id);
    if (!alreadyInThisGroup) index[code].push({ groupId: id, type });
  };

  addToIndex(nostroCodice, "nostro_codice");
  addToIndex(codiceMav, "codice_mav");
  crossReferences.forEach((c) => addToIndex(c, "cross_reference"));

  saveReferenceGroups([...groups, group]);
  saveCodeIndex(index);

  return { group, conflicts };
}

export function deleteGroup(id: string): void {
  const groups = getReferenceGroups().filter((g) => g.id !== id);
  const index = getCodeIndex();
  for (const [code, entries] of Object.entries(index)) {
    const filtered = entries.filter((e) => e.groupId !== id);
    if (filtered.length === 0) delete index[code];
    else index[code] = filtered;
  }
  saveReferenceGroups(groups);
  saveCodeIndex(index);
}
