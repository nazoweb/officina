import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, AlertTriangle } from "lucide-react";
import type { ImportSummaryData } from "@/types/codici";

interface ImportSummaryProps {
  summary: ImportSummaryData;
}

export function ImportSummary({ summary }: ImportSummaryProps) {
  const hasAmbiguities = summary.codiciAmbigui.length > 0;

  return (
    <div className="space-y-4">
      <Alert className="border-green-200 bg-green-50 dark:bg-green-950/20 dark:border-green-900">
        <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
        <AlertDescription className="text-green-800 dark:text-green-300 font-medium">
          Listino caricato correttamente. Puoi iniziare a cercare i codici.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader className="px-5 pt-5 pb-4">
          <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Riepilogo
          </CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-5">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatBox label="Righe nel file" value={summary.righeLettte} />
            <StatBox label="Prodotti caricati" value={summary.gruppiCreati} />
            <StatBox label="Codici indicizzati" value={summary.codiciTotali} />
            <StatBox
              label="Duplicati saltati"
              value={summary.duplicatiIgnorati}
              muted={summary.duplicatiIgnorati === 0}
            />
          </div>
        </CardContent>
      </Card>

      {hasAmbiguities && (
        <Alert className="border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-900">
          <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          <AlertDescription className="text-amber-800 dark:text-amber-300">
            <p className="font-medium mb-2.5">
              {summary.codiciAmbigui.length === 1
                ? "1 codice appartiene a più prodotti:"
                : `${summary.codiciAmbigui.length} codici appartengono a più prodotti:`}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {summary.codiciAmbigui.map((code) => (
                <Badge
                  key={code}
                  variant="outline"
                  className="font-mono text-xs border-amber-300 dark:border-amber-700"
                >
                  {code}
                </Badge>
              ))}
            </div>
            <p className="mt-2.5 text-xs opacity-80">
              Cercando uno di questi codici verranno mostrati tutti i prodotti corrispondenti.
            </p>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

function StatBox({
  label,
  value,
  muted,
}: {
  label: string;
  value: number;
  muted?: boolean;
}) {
  return (
    <div className="rounded-lg border bg-muted/30 px-4 py-4 text-center">
      <div className={`text-3xl font-bold tabular-nums ${muted ? "text-muted-foreground/50" : "text-foreground"}`}>
        {value.toLocaleString("it-IT")}
      </div>
      <div className="text-xs text-muted-foreground mt-1 leading-snug">{label}</div>
    </div>
  );
}
