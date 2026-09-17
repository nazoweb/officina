"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { Search, Boxes, ClipboardList, Upload, Plus } from "lucide-react";

const NAV_ITEMS = [
  { href: "/codici", label: "Ricerca prodotto", icon: Search, exact: true },
  { href: "/codici/magazzino", label: "Magazzino", icon: Boxes, exact: false },
  { href: "/codici/ordini", label: "Liste ordini", icon: ClipboardList, exact: false },
  { href: "/codici/nuovo", label: "Nuovo prodotto", icon: Plus, exact: false },
  { href: "/codici/import", label: "Importa Excel", icon: Upload, exact: false },
];

export function AppSidebar() {
  const pathname = usePathname();

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

    </Sidebar>
  );
}
