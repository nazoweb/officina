"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { CodeBadge } from "./CodeBadge";
import { Copy, Check } from "lucide-react";
import type { SearchResult, CodeType } from "@/types/codici";
import { cn } from "@/lib/utils";

interface CodeResultCardProps {
  result: SearchResult;
  showGroupNumber?: boolean;
  groupNumber?: number;
}

interface CodeRowProps {
  code: string;
  type: CodeType;
  highlighted?: boolean;
}

function CodeRow({ code, type, highlighted }: CodeRowProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div
      className={cn(
        "flex items-center justify-between rounded-md px-3 py-2.5 transition-colors",
        highlighted
          ? "bg-primary/10 ring-1 ring-primary/20"
          : "hover:bg-muted/50"
      )}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <CodeBadge type={type} />
        <span className={cn("font-mono text-sm truncate", highlighted && "font-semibold")}>
          {code}
        </span>
        {highlighted && (
          <Badge variant="secondary" className="text-xs shrink-0 h-5">
            Il tuo codice
          </Badge>
        )}
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={handleCopy}
        className="h-7 w-7 p-0 shrink-0 ml-3 text-muted-foreground hover:text-foreground"
        title="Copia codice"
      >
        {copied ? (
          <Check className="h-3.5 w-3.5 text-green-500" />
        ) : (
          <Copy className="h-3.5 w-3.5" />
        )}
      </Button>
    </div>
  );
}

export function CodeResultCard({ result, showGroupNumber, groupNumber }: CodeResultCardProps) {
  const { group, matchedCode } = result;

  type CodeEntry = { code: string; type: CodeType };
  const entries: CodeEntry[] = [];

  if (group.nostroCodice) {
    entries.push({ code: group.nostroCodice, type: "codice_interno" });
  }
  if (group.codiceMav) {
    entries.push({ code: group.codiceMav, type: "codice_mav" });
  }
  for (const cr of group.crossReferences) {
    if (cr !== group.nostroCodice && cr !== group.codiceMav) {
      entries.push({ code: cr, type: "cross_reference" });
    }
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader className="px-5 pt-5 pb-4">
        <div className="flex items-center justify-between gap-4">
          <CardTitle className="text-base font-semibold">
            {showGroupNumber && groupNumber != null
              ? `Risultato ${groupNumber}`
              : "Codici equivalenti"}
          </CardTitle>
          <span className="text-xs text-muted-foreground shrink-0">
            {entries.length} {entries.length === 1 ? "codice" : "codici"}
          </span>
        </div>
      </CardHeader>
      <Separator />
      <CardContent className="px-4 py-3">
        <div className="space-y-0.5">
          {entries.map(({ code, type }) => (
            <CodeRow
              key={`${type}-${code}`}
              code={code}
              type={type}
              highlighted={code === matchedCode}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
