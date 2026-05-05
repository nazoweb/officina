"use client";

import { SidebarTrigger } from "@/components/ui/sidebar";
import { CodiciTable } from "@/components/codici/CodiciTable";

export default function TabellaPage() {
  return (
    <>
      <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
        <SidebarTrigger className="-ml-1" />
        <span className="text-sm font-medium">Tutti i codici</span>
      </header>

      <CodiciTable />
    </>
  );
}
