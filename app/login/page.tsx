"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { LockKeyhole } from "lucide-react";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setError(""); setLoading(true);
    try {
      if (!isSupabaseConfigured) throw new Error("Manca la configurazione Supabase in .env.local.");
      const supabase = createSupabaseBrowserClient();
      const result = creating
        ? await supabase.auth.signUp({ email, password })
        : await supabase.auth.signInWithPassword({ email, password });
      if (result.error) throw result.error;
      if (creating && !result.data.session) setError("Account creato: controlla l’email per confermare l’accesso.");
      else router.replace(params.get("next") || "/codici");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Impossibile accedere."); }
    finally { setLoading(false); }
  };

  return <main className="min-h-screen grid place-items-center bg-muted/30 p-4"><form onSubmit={submit} className="w-full max-w-sm rounded-xl border bg-card p-6 shadow-sm space-y-5">
    <div className="text-center space-y-2"><div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-primary/10 text-primary"><LockKeyhole className="h-6 w-6" /></div><h1 className="text-xl font-semibold">Accesso officina</h1><p className="text-sm text-muted-foreground">Entra per usare magazzino e liste ordini.</p></div>
    <Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="email@officina.it" required autoFocus />
    <Input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="Password" minLength={6} required />
    {error && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
    <Button className="w-full" disabled={loading}>{loading ? "Attendi…" : creating ? "Crea account" : "Accedi"}</Button>
    <button type="button" onClick={() => { setCreating(!creating); setError(""); }} className="w-full text-sm text-muted-foreground hover:text-foreground">{creating ? "Hai già un account? Accedi" : "Crea un nuovo account"}</button>
  </form></main>;
}

export default function LoginPage() {
  return <Suspense fallback={<main className="min-h-screen grid place-items-center text-sm text-muted-foreground">Apertura accesso…</main>}><LoginForm /></Suspense>;
}
