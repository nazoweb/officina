"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isSupabaseConfigured) { router.replace("/login"); return; }
    const supabase = createSupabaseBrowserClient();
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) router.replace(`/login?next=${encodeURIComponent(pathname)}`);
      else setReady(true);
    }).catch(() => setError("Non riesco a verificare l’accesso. Controlla la connessione e ricarica la pagina."));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) router.replace("/login");
    });
    return () => listener.subscription.unsubscribe();
  }, [pathname, router]);

  if (error) return <div role="alert" className="p-6">{error}</div>;
  if (!ready) return <div className="min-h-screen grid place-items-center text-sm text-muted-foreground">Apertura gestionale…</div>;
  return <>{children}</>;
}
