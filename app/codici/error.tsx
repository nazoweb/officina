"use client";
import { useEffect } from "react";
import { recordActivity } from "@/lib/inventory/activity";
import { Button } from "@/components/ui/button";
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { void recordActivity("unexpected", "error", { reference: error.digest }, error); }, [error]);
  return <main className="space-y-4 p-6"><h1 className="text-xl font-semibold">Questa pagina non è disponibile</h1><p>Si è verificato un problema del sito. Riprova; se continua, contatta l’assistenza indicando la pagina che stavi usando.</p><Button onClick={reset}>Riprova</Button></main>;
}
