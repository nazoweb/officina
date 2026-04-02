"use client";

import { useState, useEffect, useRef } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Field, FieldLabel, FieldGroup } from "@/components/ui/field";
import {
  getSettings,
  saveSettings,
  downloadBackup,
  importBackup,
  clearAllData,
  type AppSettings,
  type BackupData,
} from "@/lib/storage";
import {
  Download,
  Upload,
  Trash2,
  Check,
  AlertCircle,
  Save,
  Settings,
} from "lucide-react";
import { useTheme } from "next-themes";

interface ImpostazioniTabProps {
  onDataCleared?: () => void;
}

export function ImpostazioniTab({ onDataCleared }: ImpostazioniTabProps) {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [saved, setSaved] = useState(false);
  const [importStatus, setImportStatus] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { setTheme } = useTheme();

  // Load settings on mount
  useEffect(() => {
    setSettings(getSettings());
  }, []);

  const handleSettingChange = <K extends keyof AppSettings>(
    key: K,
    value: AppSettings[K]
  ) => {
    if (!settings) return;
    
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    saveSettings(newSettings);
    
    // Apply theme immediately
    if (key === "theme") {
      setTheme(value as string);
    }
    
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleExportBackup = () => {
    downloadBackup();
  };

  const handleImportBackup = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const data: BackupData = JSON.parse(content);
        const result = importBackup(data);
        
        if (result.success) {
          setImportStatus({
            type: "success",
            message: "Backup importato con successo. I dati sono stati ripristinati.",
          });
          // Reload settings
          setSettings(getSettings());
        } else {
          setImportStatus({
            type: "error",
            message: result.error || "Errore durante l'importazione",
          });
        }
      } catch {
        setImportStatus({
          type: "error",
          message: "File JSON non valido",
        });
      }
      
      // Clear the input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      
      // Clear status after 5 seconds
      setTimeout(() => setImportStatus(null), 5000);
    };
    
    reader.readAsText(file);
  };

  const handleClearAllData = () => {
    clearAllData();
    setSettings(getSettings());
    onDataCleared?.();
  };

  if (!settings) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Settings Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            <CardTitle>Impostazioni</CardTitle>
          </div>
          <CardDescription>
            Configura le preferenze dell&apos;applicazione
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="csv-prefix">Prefisso nome file CSV</FieldLabel>
              <Input
                id="csv-prefix"
                value={settings.csvFilenamePrefix}
                onChange={(e) =>
                  handleSettingChange("csvFilenamePrefix", e.target.value)
                }
                placeholder="codici_magazzino"
              />
              <p className="text-sm text-muted-foreground">
                I file CSV verranno salvati come: prefisso_YYYY-MM-DD_HH-mm.csv
              </p>
            </Field>

            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <label
                  htmlFor="auto-save"
                  className="text-sm font-medium leading-none cursor-pointer"
                >
                  Salvataggio automatico storico
                </label>
                <p className="text-sm text-muted-foreground">
                  Salva automaticamente ogni operazione nello storico
                </p>
              </div>
              <Switch
                id="auto-save"
                checked={settings.autoSaveHistory}
                onCheckedChange={(checked) =>
                  handleSettingChange("autoSaveHistory", checked)
                }
              />
            </div>

            <Field>
              <FieldLabel htmlFor="theme">Tema</FieldLabel>
              <Select
                value={settings.theme}
                onValueChange={(v) =>
                  handleSettingChange("theme", v as AppSettings["theme"])
                }
              >
                <SelectTrigger id="theme">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="light">Chiaro</SelectItem>
                  <SelectItem value="dark">Scuro</SelectItem>
                  <SelectItem value="system">Sistema</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </FieldGroup>

          {saved && (
            <Alert>
              <Check className="h-4 w-4" />
              <AlertDescription>Impostazioni salvate</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Backup/Restore Card */}
      <Card>
        <CardHeader>
          <CardTitle>Backup e Ripristino</CardTitle>
          <CardDescription>
            Esporta o importa i dati dell&apos;applicazione
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" onClick={handleExportBackup}>
              <Download className="mr-2 h-4 w-4" />
              Esporta backup
            </Button>

            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="mr-2 h-4 w-4" />
              Importa backup
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              className="hidden"
              onChange={handleImportBackup}
            />
          </div>

          {importStatus && (
            <Alert variant={importStatus.type === "error" ? "destructive" : "default"}>
              {importStatus.type === "error" ? (
                <AlertCircle className="h-4 w-4" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              <AlertTitle>
                {importStatus.type === "error" ? "Errore" : "Successo"}
              </AlertTitle>
              <AlertDescription>{importStatus.message}</AlertDescription>
            </Alert>
          )}

          <p className="text-sm text-muted-foreground">
            Il backup include lo storico delle operazioni e le impostazioni.
          </p>
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="text-destructive">Zona Pericolosa</CardTitle>
          <CardDescription>
            Azioni irreversibili che eliminano i dati
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive">
                <Trash2 className="mr-2 h-4 w-4" />
                Cancella tutti i dati
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Sei assolutamente sicuro?</AlertDialogTitle>
                <AlertDialogDescription>
                  Questa azione non può essere annullata. Verranno eliminati
                  permanentemente:
                  <ul className="mt-2 list-inside list-disc">
                    <li>Tutto lo storico delle operazioni</li>
                    <li>Tutte le impostazioni personalizzate</li>
                    <li>Tutti i dati salvati nei tab</li>
                  </ul>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Annulla</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleClearAllData}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Elimina tutto
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>
    </div>
  );
}
