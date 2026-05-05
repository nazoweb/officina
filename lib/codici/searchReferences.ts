import { normalizeCode } from "./normalizeCode";
import { getReferenceGroups, getCodeIndex } from "./storageReferences";
import type { SearchResult } from "@/types/codici";

export function searchByCode(rawQuery: string): SearchResult[] {
  const query = normalizeCode(rawQuery);
  if (!query) return [];

  const index = getCodeIndex();
  const entries = index[query];

  if (!entries || entries.length === 0) return [];

  const groups = getReferenceGroups();
  const groupMap = new Map(groups.map((g) => [g.id, g]));

  const results: SearchResult[] = [];
  for (const entry of entries) {
    const group = groupMap.get(entry.groupId);
    if (!group) continue;
    results.push({
      group,
      matchedCode: query,
      matchedType: entry.type,
    });
  }

  return results;
}
