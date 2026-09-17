import Link from "next/link";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { OrderWorkspace } from "@/components/inventory/Orders";
export default async function OrdinePage({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; return <><header className="flex h-14 items-center gap-2 border-b px-4"><SidebarTrigger className="-ml-1" /><Button asChild variant="ghost" size="sm"><Link href="/codici/ordini"><ArrowLeft className="mr-1 h-4 w-4" />Liste ordini</Link></Button></header><main className="mx-auto w-full max-w-5xl px-4 py-7 sm:px-6"><OrderWorkspace orderId={id} /></main></> }
