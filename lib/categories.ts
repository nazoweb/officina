export const CATEGORIES = {
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

export type CategoryCode = keyof typeof CATEGORIES;

export const SECRET_KEY = "MAGAZZINO_OFFICINA_2026";

export function isValidCategory(code: string): code is CategoryCode {
  return code in CATEGORIES;
}

export function getCategoryName(code: CategoryCode): string {
  return CATEGORIES[code];
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
