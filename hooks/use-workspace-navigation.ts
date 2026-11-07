"use client";

import { useEffect, useRef, useState } from "react";

export function safeReturnPath(value: string | null, fallback = "/codici/magazzino") {
  if (!value || !/^\/codici(?:[/?]|$)/.test(value) || /[\\\r\n]/.test(value)) return fallback;
  return value;
}

export function returnLabel(path: string) {
  if (path === "/codici" || path.startsWith("/codici?")) return "Torna alla ricerca";
  if (path.startsWith("/codici/ddt/")) return "Torna al documento";
  if (path.startsWith("/codici/ddt")) return "Torna ai documenti";
  if (path.startsWith("/codici/vendite")) return "Torna alla vendita";
  return "Torna al magazzino";
}

export function useReturnTo(fallback = "/codici/magazzino") {
  const [path, setPath] = useState(fallback);
  useEffect(() => { setPath(safeReturnPath(new URLSearchParams(window.location.search).get("returnTo"), fallback)); }, [fallback]);
  return path;
}

/** Only view preferences and filters belong here, never product/customer records. */
export function useWorkspaceState<T>(key: string, initial: T) {
  const [value, setValue] = useState(initial);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    try { const saved = sessionStorage.getItem(`officina-view:${key}`); if (saved) setValue(JSON.parse(saved)); } catch { /* View restoration is optional. */ }
    setReady(true);
  }, [key]);
  useEffect(() => { if (ready) try { sessionStorage.setItem(`officina-view:${key}`, JSON.stringify(value)); } catch { /* Optional. */ } }, [key, ready, value]);
  return [value, setValue, ready] as const;
}

export function useUnsavedChanges(dirty: boolean) {
  const unsaved = useRef(dirty);
  unsaved.current = dirty;
  useEffect(() => {
    const unload = (event: BeforeUnloadEvent) => { if (unsaved.current) { event.preventDefault(); event.returnValue = ""; } };
    const navigate = (event: MouseEvent) => {
      if (!unsaved.current || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = (event.target as Element).closest?.("a[href]") as HTMLAnchorElement | null;
      if (!link || link.target === "_blank" || link.hasAttribute("download") || link.href === window.location.href || link.getAttribute("href")?.startsWith("#")) return;
      if (!window.confirm("Ci sono modifiche non salvate. Vuoi uscire e scartarle?")) { event.preventDefault(); event.stopPropagation(); }
    };
    window.addEventListener("beforeunload", unload);
    document.addEventListener("click", navigate, true);
    return () => { window.removeEventListener("beforeunload", unload); document.removeEventListener("click", navigate, true); };
  }, []);
  return () => { unsaved.current = false; };
}
