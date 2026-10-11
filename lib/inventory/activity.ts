"use client";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { UserFacingError, userErrorMessage } from "@/lib/user-errors";

export const activityLabels: Record<string, string> = {
  listClients: "Lettura aziende", saveClient: "Salvataggio azienda", deleteClient: "Eliminazione azienda", getDeliverySettings: "Lettura impostazioni documenti", saveDeliverySettings: "Salvataggio impostazioni documenti", listDocuments: "Lettura documenti", getDocument: "Apertura documento", saveDocument: "Salvataggio bozza documento", issueDocument: "Emissione documento", cancelDocument: "Annullamento documento", deleteDraft: "Eliminazione bozza", documentPdf: "Generazione PDF documento",
  listProducts: "Apertura magazzino", findProductsByCode: "Ricerca o scansione codice", getProduct: "Apertura prodotto", saveProduct: "Salvataggio prodotto", createProduct: "Creazione prodotto", deleteProduct: "Eliminazione prodotto",
  listCategories: "Lettura categorie", createCategory: "Creazione categoria", renameCategory: "Rinomina categoria", deleteCategory: "Eliminazione categoria", assignProductsCategory: "Assegnazione categoria",
  updateOrder: "Modifica lista", deleteOrder: "Eliminazione lista", upsertImportedProduct: "Importazione prodotto da Excel", createOrder: "Creazione lista", listOrders: "Apertura liste ordini", getOrder: "Apertura lista", scanProductIntoOrder: "Aggiunta prodotto alla lista", setOrderItemQuantity: "Modifica quantità nella lista", closeOrder: "Chiusura lista", adjustStock: "Rettifica giacenza", navigation: "Apertura pagina", unexpected: "Problema imprevisto", importFile: "Lettura file Excel", importCompleted: "Importazione Excel completata",
};
let sessionId: string | undefined;
function session() {
  if (typeof window === "undefined") return null;
  if (!sessionId) { try { sessionId = sessionStorage.getItem("officina-activity-session") || crypto.randomUUID(); sessionStorage.setItem("officina-activity-session", sessionId); } catch { sessionId = crypto.randomUUID(); } }
  return sessionId;
}

// No passwords, tokens, customer notes or spreadsheet contents are recorded.
function diagnostic(cause: unknown) {
  const e = cause as { message?: string; code?: string; details?: string; hint?: string } | null;
  const redact = (s: string) => s.replace(/Bearer\s+\S+|eyJ[\w.-]+|(?:password|token|secret|apikey)\s*[=:]\s*[^\s,;]+/gi, "[omesso]");
  return { code: e?.code?.slice(0, 80) || null, message: redact(e?.message || "Errore senza dettagli").slice(0, 2000) };
}
export async function recordActivity(action: string, status: "success" | "error", metadata: Record<string, unknown> = {}, cause?: unknown, eventId = crypto.randomUUID()) {
  if (typeof window === "undefined") return eventId;
  const details = cause ? diagnostic(cause) : null;
  try {
    const client = createSupabaseBrowserClient();
    const { data } = await client.auth.getSession();
    if (!data.session) return eventId;
    const entry = { p_id: eventId, p_session_id: session(), p_action: action, p_status: status, p_route: window.location.pathname, p_metadata: metadata, p_user_message: cause ? userErrorMessage(cause) : null, p_technical_code: details?.code || null, p_technical_message: details?.message || null };
    const key = `officina-pending-activity-${data.session.user.id}`;
    const read = (): typeof entry[] => { try { return JSON.parse(localStorage.getItem(key) || "[]"); } catch { return []; } };
    const write = (entries: typeof entry[]) => { try { localStorage.setItem(key, JSON.stringify(entries.slice(-100))); } catch { /* Logging must never prevent an operation. */ } };
    write([...read().filter(event => event.p_id !== eventId), entry]);
    const batch = [...read().filter(event => event.p_id !== eventId).slice(0, 9), entry];
    const delivered = await Promise.all(batch.map(async event => {
      try { const { error } = await client.rpc("record_activity_event", event).abortSignal(AbortSignal.timeout(2000)); return error ? null : event.p_id; }
      catch { return null; }
    }));
    write(read().filter(event => !delivered.includes(event.p_id)));
    if (!delivered.includes(eventId)) console.warn("Registro attività non raggiungibile; attività conservata per il prossimo tentativo", { reference: eventId });
  } catch { console.warn("Registro attività non raggiungibile", { reference: eventId }); }
  return eventId;
}
function context(action: string, args: unknown[]) {
  const first = args[0] as Record<string, unknown> | string | undefined;
  if (action === "saveProduct" || action === "createProduct" || action === "upsertImportedProduct") { const draft = first as Record<string, unknown>; return { code: draft?.internal_code, category: draft?.category, productId: (args[1] as { id?: string })?.id }; }
  if (action === "findProductsByCode") return { code: first };
  if (["createCategory", "renameCategory", "deleteCategory"].includes(action)) return { category: first, newCategory: action === "renameCategory" ? args[1] : undefined, deleteProducts: action === "deleteCategory" ? args[1] : undefined, count: args[2] };
  if (action === "assignProductsCategory") return { productIds: (args[0] as string[]).slice(0, 20), count: (args[0] as string[]).length, category: args[1] };
  if (action === "createOrder") return {};
  return { id: typeof first === "string" ? first : first?.id, productId: action === "scanProductIntoOrder" ? args[1] : undefined, quantity: action === "setOrderItemQuantity" || action === "adjustStock" ? args[1] : undefined, restoreStock: action === "deleteOrder" ? args[1] : undefined };
}
export function tracked<Args extends unknown[], Result>(action: string, operation: (...args: Args) => Promise<Result>) {
  return async (...args: Args): Promise<Result> => {
    try {
      const result = await operation(...args);
      const summary = Array.isArray(result) ? { resultCount: result.length } : { resultId: typeof result === "string" ? result : (result as { id?: string })?.id };
      await recordActivity(action, "success", { ...context(action, args), ...summary });
      return result;
    } catch (cause) {
      const id = crypto.randomUUID();
      await recordActivity(action, "error", context(action, args), cause, id);
      const message = userErrorMessage(cause, `Non è stato possibile completare: ${(activityLabels[action] || "operazione").toLowerCase()}. Riprova; se il problema continua, contatta l’assistenza.`);
      throw new UserFacingError(message, id.slice(0, 8).toUpperCase());
    }
  };
}
