import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/codici/AppSidebar";
import { AuthGate } from "@/components/auth/AuthGate";

export default function CodiciLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGate><SidebarProvider>
      <AppSidebar />
      <SidebarInset>{children}</SidebarInset>
    </SidebarProvider></AuthGate>
  );
}
