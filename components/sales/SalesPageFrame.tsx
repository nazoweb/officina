import type { ReactNode } from 'react';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { PageFrame } from '@/components/codici/PageFrame';
export function SalesPageFrame({title,description,children}:{title:string;description?:string;children:ReactNode}){
  return <><header className="flex h-14 items-center gap-2 border-b px-4"><SidebarTrigger className="-ml-1"/><span className="text-sm font-medium">{title}</span></header><PageFrame title={description?title:undefined} description={description}>{children}</PageFrame></>;
}
