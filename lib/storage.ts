import type { EncodeResult, DecodeResult, BulkError } from "@/types";

// ========================================
// HISTORY TYPES
// ========================================

export type HistoryType = "codifica" | "decodifica" | "multiplo";

export interface HistoryEntry {
  id: string;
  type: HistoryType;
  timestamp: number;
  input: string;
  results: EncodeResult[] | DecodeResult[];
  errors?: BulkError[];
}

// ========================================
// SETTINGS TYPES
// ========================================

export interface AppSettings {
  csvFilenamePrefix: string;
  autoSaveHistory: boolean;
  clearHistoryOnExit: boolean;
  theme: "light" | "dark" | "system";
}

export const DEFAULT_SETTINGS: AppSettings = {
  csvFilenamePrefix: "codici_magazzino",
  autoSaveHistory: true,
  clearHistoryOnExit: false,
  theme: "system",
};

// ========================================
// STORAGE KEYS
// ========================================

const HISTORY_KEY = "warehouse-codes-history";
const SETTINGS_KEY = "warehouse-codes-settings";

// ========================================
// UUID GENERATOR
// ========================================

export function generateId(): string {
  return crypto.randomUUID();
}

// ========================================
// HISTORY FUNCTIONS
// ========================================

export function getHistory(): HistoryEntry[] {
  if (typeof window === "undefined") return [];
  
  const stored = localStorage.getItem(HISTORY_KEY);
  if (!stored) return [];
  
  try {
    return JSON.parse(stored) as HistoryEntry[];
  } catch {
    return [];
  }
}

export function saveHistory(history: HistoryEntry[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
}

export function addHistoryEntry(entry: Omit<HistoryEntry, "id" | "timestamp">): HistoryEntry {
  const history = getHistory();
  const newEntry: HistoryEntry = {
    ...entry,
    id: generateId(),
    timestamp: Date.now(),
  };
  
  // Add to beginning (most recent first)
  history.unshift(newEntry);
  saveHistory(history);
  
  return newEntry;
}

export function deleteHistoryEntry(id: string): void {
  const history = getHistory();
  const filtered = history.filter((entry) => entry.id !== id);
  saveHistory(filtered);
}

export function clearHistory(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(HISTORY_KEY);
}

// ========================================
// SETTINGS FUNCTIONS
// ========================================

export function getSettings(): AppSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  
  const stored = localStorage.getItem(SETTINGS_KEY);
  if (!stored) return DEFAULT_SETTINGS;
  
  try {
    const parsed = JSON.parse(stored);
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: AppSettings): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export function resetSettings(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(SETTINGS_KEY);
}

// ========================================
// BACKUP / RESTORE
// ========================================

export interface BackupData {
  version: number;
  exportedAt: string;
  history: HistoryEntry[];
  settings: AppSettings;
}

export function exportBackup(): BackupData {
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    history: getHistory(),
    settings: getSettings(),
  };
}

export function importBackup(data: BackupData): { success: boolean; error?: string } {
  try {
    // Validate structure
    if (!data || typeof data !== "object") {
      return { success: false, error: "Formato backup non valido" };
    }
    
    if (!Array.isArray(data.history)) {
      return { success: false, error: "Storico non valido nel backup" };
    }
    
    // Import history
    saveHistory(data.history);
    
    // Import settings if present
    if (data.settings && typeof data.settings === "object") {
      saveSettings({ ...DEFAULT_SETTINGS, ...data.settings });
    }
    
    return { success: true };
  } catch {
    return { success: false, error: "Errore durante l'importazione del backup" };
  }
}

export function downloadBackup(): void {
  const backup = exportBackup();
  const json = JSON.stringify(backup, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  
  const now = new Date();
  const timestamp = formatTimestamp(now);
  
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `backup_codici_magazzino_${timestamp}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// ========================================
// CLEAR ALL DATA
// ========================================

export function clearAllData(): void {
  if (typeof window === "undefined") return;
  
  // Clear history and settings
  clearHistory();
  resetSettings();
  
  // Clear tab states
  localStorage.removeItem("codifica-tab-state");
  localStorage.removeItem("decodifica-tab-state");
  localStorage.removeItem("inserimento-multiplo-tab-state");
}

// ========================================
// UTILITY FUNCTIONS
// ========================================

export function formatTimestamp(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  
  return `${year}-${month}-${day}_${hours}-${minutes}`;
}

export function formatDateTimeDisplay(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleString("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function getHistoryTypeLabel(type: HistoryType): string {
  switch (type) {
    case "codifica":
      return "Codifica";
    case "decodifica":
      return "Decodifica";
    case "multiplo":
      return "Inserimento Multiplo";
    default:
      return type;
  }
}
