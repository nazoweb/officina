import { Badge } from "@/components/ui/badge";
import type { CodeType } from "@/types/codici";

interface CodeBadgeProps {
  type: CodeType;
}

const CONFIG: Record<CodeType, { label: string; className: string }> = {
  codice_interno: {
    label: "Codice interno",
    className: "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800 font-medium",
  },
  codice_mav: {
    label: "Codice MAV",
    className: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800 font-medium",
  },
  cross_reference: {
    label: "Rif. esterno",
    className: "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800 font-medium",
  },
};

export function CodeBadge({ type }: CodeBadgeProps) {
  const { label, className } = CONFIG[type];
  return (
    <Badge variant="outline" className={`shrink-0 text-xs ${className}`}>
      {label}
    </Badge>
  );
}
