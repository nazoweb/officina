"use client";

import { createBrowserClient } from "@supabase/ssr";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export const isSupabaseConfigured = Boolean(url && key);

export function createSupabaseBrowserClient() {
  if (!url || !key) throw new Error("Supabase non è configurato. Copia .env.example in .env.local e inserisci le credenziali del progetto.");
  return createBrowserClient(url, key);
}
