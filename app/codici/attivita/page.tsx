import { ActivityLog } from "@/components/inventory/ActivityLog";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { PageFrame } from "@/components/codici/PageFrame";
export default function ActivityPage() { return <><header className="flex h-14 items-center gap-2 border-b px-4"><SidebarTrigger className="-ml-1" /><span className="text-sm font-medium">Registro attività</span></header><PageFrame title="Registro attività" description="Operazioni e problemi per ricostruire ciò che è successo."><ActivityLog /></PageFrame></>; }
