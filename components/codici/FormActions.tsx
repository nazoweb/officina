"use client";

import type { ReactNode } from "react";

/** Keep the form's primary actions in reach, including on small screens. */
export function FormActions({ children, status, error }: { children: ReactNode; status?: ReactNode; error?: string }) {
  return <div className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-background p-3 shadow-sm">
    <div className="flex flex-wrap items-center gap-2">{children}</div>
    {status && <span role="status" className="text-sm text-muted-foreground">{status}</span>}
    {error && <p role="alert" className="w-full text-sm text-destructive">{error}</p>}
  </div>;
}
