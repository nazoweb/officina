"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Search, Table2, Upload, Moon, Sun, Plus } from "lucide-react";

const NAV_ITEMS = [
  { href: "/codici", label: "Ricerca", icon: Search, exact: true },
  { href: "/codici/tabella", label: "Tutti i codici", icon: Table2, exact: false },
  { href: "/codici/nuovo", label: "Crea codice", icon: Plus, exact: false },
  { href: "/codici/import", label: "Carica Excel", icon: Upload, exact: false },
];

export function AppSidebar() {
  const pathname = usePathname();
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  return (
    <Sidebar collapsible="offcanvas">

      <SidebarHeader className="p-4">
        <Link href="/codici">
          <Image
            src="/logooff.png"
            alt="Officina Trabassi"
            width={150}
            height={45}
            className="h-8 w-auto object-contain invert dark:invert-0"
            priority
          />
        </Link>
      </SidebarHeader>

      <SidebarSeparator className="mx-0" />

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Menu</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV_ITEMS.map(({ href, label, icon: Icon, exact }) => {
                const active = exact ? pathname === href : pathname.startsWith(href);
                return (
                  <SidebarMenuItem key={href}>
                    <SidebarMenuButton asChild isActive={active}>
                      <Link href={href}>
                        <Icon className="h-4 w-4" />
                        <span>{label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarSeparator className="mx-0" />

      <SidebarFooter className="p-3">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2"
          onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
        >
          {mounted && resolvedTheme === "dark" ? (
            <Sun className="h-4 w-4" />
          ) : (
            <Moon className="h-4 w-4" />
          )}
          <span className="text-sm">
            {mounted && resolvedTheme === "dark" ? "Tema chiaro" : "Tema scuro"}
          </span>
        </Button>
      </SidebarFooter>

    </Sidebar>
  );
}
