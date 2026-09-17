import type { ReactNode } from "react";

interface PageFrameProps {
  children: ReactNode;
  title?: string;
  description?: string;
}

/** Shared content bounds for every authenticated workspace page. */
export function PageFrame({ children, title, description }: PageFrameProps) {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-7 sm:px-6 lg:px-8">
      {title && <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>}
      {description && <p className="mb-6 mt-1 text-sm text-muted-foreground">{description}</p>}
      {children}
    </main>
  );
}
