export function normalizeCode(raw: unknown): string {
  if (raw === null || raw === undefined) return "";
  return String(raw).trim().toUpperCase();
}

export function isValidCode(code: string): boolean {
  return code.length > 0;
}

export function parseCrossReferences(raw: unknown): string[] {
  if (raw === null || raw === undefined) return [];
  const str = String(raw).trim();
  if (!str) return [];

  const parts = str.split(/[;,/\r\n]+/);
  const result: string[] = [];
  const seen = new Set<string>();

  for (const part of parts) {
    const normalized = normalizeCode(part);
    if (isValidCode(normalized) && !seen.has(normalized)) {
      seen.add(normalized);
      result.push(normalized);
    }
  }

  return result;
}
