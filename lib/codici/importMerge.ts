import type {
  ParsedExcelRow,
  PreviewRow,
  MergeResultData,
  ReferenceGroup,
  CodeIndex,
  CodeType,
} from "@/types/codici";
import { normalizeCode, isValidCode, parseCrossReferences } from "./normalizeCode";
import { getReferenceGroups, getCodeIndex, saveReferenceGroups, saveCodeIndex } from "./storageReferences";

export function buildPreviewRows(
  parsedRows: ParsedExcelRow[],
  existingGroups: ReferenceGroup[],
  codeIndex: CodeIndex
): PreviewRow[] {
  const groupMap = new Map(existingGroups.map((g) => [g.id, g]));

  return parsedRows.map((row) => {
    const nostroCodice = normalizeCode(row.nostroCodice);
    const codiceMav = normalizeCode(row.codiceMav);
    const incomingRefs = parseCrossReferences(row.crossReference);

    // Find existing group by nostroCodice first, then codiceMav
    let existingGroupId: string | undefined;
    if (isValidCode(nostroCodice)) {
      const entry = codeIndex[nostroCodice]?.find((e) => e.type === "codice_interno");
      if (entry) existingGroupId = entry.groupId;
    }
    if (!existingGroupId && isValidCode(codiceMav)) {
      const entry = codeIndex[codiceMav]?.find((e) => e.type === "codice_mav");
      if (entry) existingGroupId = entry.groupId;
    }

    if (!existingGroupId) {
      return {
        id: crypto.randomUUID(),
        nostroCodice,
        codiceMav,
        crossRef: incomingRefs.join("; "),
        selected: true,
        status: "new",
        newCrossRefs: incomingRefs,
        removedCrossRefs: [],
      };
    }

    const existingGroup = groupMap.get(existingGroupId)!;
    const existingRefSet = new Set(existingGroup.crossReferences);
    const newCrossRefs = incomingRefs.filter((r) => !existingRefSet.has(r));
    const removedCrossRefs = existingGroup.crossReferences.filter((r) => !incomingRefs.includes(r));
    const oldCodiceMav = existingGroup.codiceMav !== codiceMav ? existingGroup.codiceMav : undefined;
    const status = newCrossRefs.length > 0 || removedCrossRefs.length > 0 || oldCodiceMav ? "updated" : "unchanged";

    return {
      id: crypto.randomUUID(),
      nostroCodice,
      codiceMav,
      crossRef: incomingRefs.join("; "),
      selected: status === "updated",
      status,
      existingGroupId,
      newCrossRefs,
      removedCrossRefs,
      oldCodiceMav,
    };
  });
}

export function applyMerge(previewRows: PreviewRow[]): MergeResultData {
  const groups = getReferenceGroups();
  const index = getCodeIndex();
  const groupMap = new Map(groups.map((g) => [g.id, g]));

  let nuovi = 0;
  let aggiornati = 0;
  let saltati = 0;
  let nuoviCrossRef = 0;
  const now = Date.now();
  const newGroups: ReferenceGroup[] = [];

  for (const row of previewRows) {
    if (!row.selected) {
      saltati++;
      continue;
    }

    if (row.status === "new") {
      const refs = parseCrossReferences(row.crossRef).filter(isValidCode);
      const nostroCodice = normalizeCode(row.nostroCodice);
      const codiceMav = normalizeCode(row.codiceMav);
      const allCodesSet = new Set<string>();
      if (isValidCode(nostroCodice)) allCodesSet.add(nostroCodice);
      if (isValidCode(codiceMav)) allCodesSet.add(codiceMav);
      refs.forEach((r) => allCodesSet.add(r));

      const id = crypto.randomUUID();
      const group: ReferenceGroup = {
        id, nostroCodice, codiceMav,
        crossReferences: refs,
        allCodes: Array.from(allCodesSet),
        createdAt: now, updatedAt: now,
      };
      newGroups.push(group);

      const addToIndex = (code: string, type: CodeType) => {
        if (!isValidCode(code)) return;
        if (!index[code]) index[code] = [];
        if (!index[code].some((e) => e.groupId === id)) index[code].push({ groupId: id, type });
      };
      addToIndex(nostroCodice, "codice_interno");
      addToIndex(codiceMav, "codice_mav");
      refs.forEach((r) => addToIndex(r, "cross_reference"));

      nuovi++;
      nuoviCrossRef += refs.length;
    } else if (row.status === "updated" && row.existingGroupId) {
      const existingGroup = groupMap.get(row.existingGroupId);
      if (!existingGroup) { saltati++; continue; }

      // Re-compute new refs from possibly-edited crossRef vs what's already in the group
      const existingRefSet = new Set(existingGroup.crossReferences);
      const editedRefs = parseCrossReferences(row.crossRef).filter(isValidCode);
      const refsToAdd = editedRefs.filter((r) => !existingRefSet.has(r));
      const refsToRemove = existingGroup.crossReferences.filter((r) => !editedRefs.includes(r));

      // Update cross references
      if (refsToRemove.length > 0) {
        existingGroup.crossReferences = existingGroup.crossReferences.filter((r) => !refsToRemove.includes(r));
        refsToRemove.forEach((r) => {
          if (index[r]) {
            index[r] = index[r].filter((e) => e.groupId !== existingGroup.id);
          }
        });
      }

      // Update MAV if it changed
      if (row.oldCodiceMav && row.codiceMav !== row.oldCodiceMav) {
        existingGroup.codiceMav = row.codiceMav;
        if (index[row.oldCodiceMav]) {
          index[row.oldCodiceMav] = index[row.oldCodiceMav].filter((e) => e.groupId !== existingGroup.id);
        }
        if (!index[row.codiceMav]) index[row.codiceMav] = [];
        if (!index[row.codiceMav].some((e) => e.groupId === existingGroup.id)) {
          index[row.codiceMav].push({ groupId: existingGroup.id, type: "codice_mav" });
        }
      }

      // Add new refs
      if (refsToAdd.length > 0) {
        existingGroup.crossReferences = [...existingGroup.crossReferences, ...refsToAdd];
        refsToAdd.forEach((r) => {
          if (!existingGroup.allCodes.includes(r)) existingGroup.allCodes.push(r);
          if (!index[r]) index[r] = [];
          if (!index[r].some((e) => e.groupId === existingGroup.id)) {
            index[r].push({ groupId: existingGroup.id, type: "cross_reference" });
          }
        });
        nuoviCrossRef += refsToAdd.length;
      }

      if (refsToAdd.length > 0 || refsToRemove.length > 0 || (row.oldCodiceMav && row.codiceMav !== row.oldCodiceMav)) {
        existingGroup.updatedAt = now;
        aggiornati++;
      } else {
        saltati++;
      }
    }
  }

  saveReferenceGroups([...groups, ...newGroups]);
  saveCodeIndex(index);

  return { nuovi, aggiornati, saltati, nuoviCrossRef };
}
