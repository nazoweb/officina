"use client";

import { UserFacingError } from "@/lib/user-errors";
import { createBrowserClient } from "@supabase/ssr";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export const isSupabaseConfigured = Boolean(url && key);

export function createSupabaseBrowserClient() {
  if (!url || !key) throw new UserFacingError("Il sito non è pronto per l’accesso. Contatta l’assistenza.");
  return createBrowserClient(url, key);
}
