export const DEFAULT_CATEGORIES = {
  "01": "Motorini di avviamento",
  "02": "Luci",
  "03": "Batterie",
  "04": "Alternatori",
  "05": "Filtri",
  "06": "Freni",
  "07": "Cinghie",
  "08": "Candele",
  "09": "Sensori",
  "10": "Radiatori",
} as const;

export type DefaultCategoryCode = keyof typeof DEFAULT_CATEGORIES;
export type CategoryCode = string;

export const SECRET_KEY = "MAGAZZINO_OFFICINA_2026";

const USER_CATEGORIES_KEY = "warehouse-codes-user-categories";
const CATEGORY_UPDATED_EVENT = "categories-updated";

function canUseStorage(): boolean {
  return typeof window !== "undefined";
}

function isValidCategoryCodeFormat(code: string): boolean {
  return /^\d{2}$/.test(code);
}

function dispatchCategoriesUpdated(): void {
  if (!canUseStorage()) return;
  window.dispatchEvent(new Event(CATEGORY_UPDATED_EVENT));
}

export function getUserCategories(): Record<string, string> {
  if (!canUseStorage()) return { ...DEFAULT_CATEGORIES };

  const stored = localStorage.getItem(USER_CATEGORIES_KEY);
  if (!stored) return { ...DEFAULT_CATEGORIES };

  try {
    const parsed = JSON.parse(stored);
    if (!parsed || typeof parsed !== "object") return {};

    const sanitized: Record<string, string> = {};
    for (const [rawCode, rawName] of Object.entries(parsed)) {
      if (typeof rawCode !== "string" || typeof rawName !== "string") continue;

      const normalizedCode = normalizeCategory(rawCode);
      const normalizedName = rawName.trim();

      if (!isValidCategoryCodeFormat(normalizedCode)) continue;
      if (!normalizedName) continue;

      sanitized[normalizedCode] = normalizedName;
    }

    return Object.keys(sanitized).length > 0 ? sanitized : { ...DEFAULT_CATEGORIES };
  } catch {
    return { ...DEFAULT_CATEGORIES };
  }
}

export function saveUserCategories(categories: Record<string, string>): void {
  if (!canUseStorage()) return;

  const sanitized: Record<string, string> = {};
  for (const [rawCode, rawName] of Object.entries(categories)) {
    const normalizedCode = normalizeCategory(rawCode);
    const normalizedName = rawName.trim();

    if (!isValidCategoryCodeFormat(normalizedCode)) continue;
    if (!normalizedName) continue;

    sanitized[normalizedCode] = normalizedName;
  }

  localStorage.setItem(USER_CATEGORIES_KEY, JSON.stringify(sanitized));
  dispatchCategoriesUpdated();
}

export function clearUserCategories(): void {
  if (!canUseStorage()) return;
  localStorage.removeItem(USER_CATEGORIES_KEY);
  dispatchCategoriesUpdated();
}

export function upsertUserCategory(
  categoryCode: string,
  categoryName: string
): { success: boolean; error?: string } {
  const normalizedCode = normalizeCategory(categoryCode);
  const normalizedName = categoryName.trim();

  if (!isValidCategoryCodeFormat(normalizedCode)) {
    return { success: false, error: "Il codice categoria deve essere numerico a 2 cifre" };
  }

  if (!normalizedName) {
    return { success: false, error: "Il nome categoria non puo essere vuoto" };
  }

  const allCategories = getAllCategories();

  const normalizedNameLower = normalizedName.toLocaleLowerCase("it-IT");
  const nameConflictEntry = Object.entries(allCategories).find(([existingCode, existingName]) => {
    return (
      existingCode !== normalizedCode &&
      existingName.trim().toLocaleLowerCase("it-IT") === normalizedNameLower
    );
  });

  if (nameConflictEntry) {
    const [conflictingCode] = nameConflictEntry;
    return {
      success: false,
      error: `Il nome categoria e gia in uso dal codice ${conflictingCode}`,
    };
  }

  const categories = getUserCategories();
  categories[normalizedCode] = normalizedName;
  saveUserCategories(categories);

  return { success: true };
}

export function deleteUserCategory(categoryCode: string): { success: boolean; error?: string } {
  const normalizedCode = normalizeCategory(categoryCode);

  const categories = getUserCategories();
  if (!(normalizedCode in categories)) {
    return { success: false, error: "Categoria non trovata" };
  }

  delete categories[normalizedCode];
  saveUserCategories(categories);

  return { success: true };
}

export function getAllCategories(): Record<string, string> {
  return {
    ...DEFAULT_CATEGORIES,
    ...getUserCategories(),
  };
}

export function getCategoryOptions(): [string, string][] {
  return Object.entries(getAllCategories()).sort(
    ([codeA], [codeB]) => Number(codeA) - Number(codeB)
  );
}

export function getCategoryUpdateEventName(): string {
  return CATEGORY_UPDATED_EVENT;
}

export function isValidCategory(code: string): code is CategoryCode {
  return code in getAllCategories();
}

export function getCategoryName(code: CategoryCode): string {
  return getAllCategories()[code];
}

export function normalizeCategory(input: string): string {
  const trimmed = input.trim();
  
  // Check if input contains only digits
  if (/^\d+$/.test(trimmed)) {
    const num = parseInt(trimmed, 10);
    // Convert back to 2-digit string
    return num.toString().padStart(2, "0");
  }
  
  return trimmed;
}
