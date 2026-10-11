export class UserFacingError extends Error {
  constructor(message: string, public reference?: string) { super(message); this.name = "UserFacingError"; }
}

const businessMessages = new Set([
  "Controlla i dati del veicolo e riprova.",
  "Uno dei testi è troppo lungo. Riduci indirizzi, note o dati del veicolo.",
  'Aggiungi da 1 a 500 righe al documento.',
  'Completa i dati dell’officina e la verifica amministrativa nelle impostazioni documenti prima di emettere.',
  'Completa indirizzo e partita IVA o codice fiscale dell’azienda prima di emettere.',
  'Completa nome, indirizzo e dati fiscali dell’officina nelle impostazioni documenti.',
  'Controlla quantità, prezzi e sconti. Usa fino a 3 decimali per le quantità e 2 per gli importi.',
  'Documento non trovato. Ricarica la pagina.',
  'Il codice prodotto è obbligatorio.',
  'Il documento contiene troppi dati. Riduci le descrizioni.',
  'Il documento è cambiato. Riaprilo prima di annullarlo.',
  'Il documento è cambiato. Riaprilo prima di emetterlo.',
  'Il documento è cambiato. Riaprilo prima di salvare.',
  'Il documento è già emesso. Puoi annullarlo, ma non modificarlo.',
  'Il prodotto non esiste più.',
  'Il prodotto è cambiato nel frattempo. Riapri la scheda prima di salvare.',
  'Il totale è troppo grande. Controlla quantità e prezzi.',
  'Indica il motivo dell’annullamento, fino a 1000 caratteri.',
  'Inserisci causale e indirizzo di destinazione per il documento di trasporto.',
  'Inserisci chilometri interi, a partire da zero.',
  'Inserisci una data documento valida.',
  'Inserisci una descrizione per ogni riga, fino a 1000 caratteri.',
  'La bozza è cambiata o è già emessa. Riaprila prima di eliminarla.',
  'La data precede un documento già emesso in questa serie. Scegli una data successiva o contatta l’amministrazione.',
  'La data è futura. Salva una bozza oppure scegli la data corretta prima di emettere.',
  'La quantità deve essere maggiore di zero e lo sconto tra 0 e 100.',
  'La scorta minima non può essere negativa.',
  'Ogni prezzo richiede nome e importo.',
  'Questo documento è annullato e non può essere emesso.',
  'Scegli un’azienda disponibile prima di salvare.',
  'Un prodotto non è più disponibile. Rimuovi la riga o scegli un altro prodotto.',

  "Riapri la lista prima di modificarne i prodotti.", "Il codice prodotto è obbligatorio.",
  "Il prodotto non esiste più.", "Il prodotto è cambiato nel frattempo. Riapri la scheda prima di salvare.",
  "La scorta minima non può essere negativa.", "Ogni prezzo richiede nome e importo.",
  "Inserisci un nome per la categoria.", "La categoria è cambiata. Ricarica prima di eliminarla.",
]);

export function userErrorMessage(cause: unknown, fallback = "Non è stato possibile completare l’operazione. Riprova; se il problema continua, contatta l’assistenza."): string {
  if (cause instanceof UserFacingError) return cause.message + (cause.reference ? ` Riferimento per l’assistenza: ${cause.reference}.` : "");
  const error = cause as { code?: string; message?: string } | null;
  const message = error?.message || "";
  if (businessMessages.has(message)) return message;
  if (/^Accedi per /.test(message) || ["42501", "PGRST301", "PGRST302"].includes(error?.code || "")) return "L’accesso è scaduto oppure non puoi eseguire questa operazione. Accedi di nuovo; se il problema continua, contatta l’assistenza.";
  if (error?.code === "23505") return "Questo codice o nome è già utilizzato. Scegline uno diverso e riprova.";
  if (error?.code === "23514") return "Uno dei campi non è valido. Controlla i dati inseriti e riprova.";
  if (["22007", "22008"].includes(error?.code || "")) return "La data non è valida. Scegli una data dal calendario e riprova.";
  if (error?.code === "23503") return "Questo elemento è collegato ad altri dati. Ricarica la pagina e riprova; se il problema continua, contatta l’assistenza.";
  if (["22P02", "22003"].includes(error?.code || "") || message === "Quantità non valida.") return "Controlla le quantità e i prezzi: inserisci numeri validi, senza lettere, e riprova.";
  if (["PGRST116"].includes(error?.code || "") || ["Categoria non trovata.", "Lista non trovata.", "Riga ordine non trovata.", "Prodotto non disponibile."].includes(message)) return "L’elemento non è più disponibile. Ricarica la pagina per vedere i dati aggiornati.";
  if (message === "Lista ordine non disponibile.") return "La lista non è disponibile oppure è già chiusa. Ricarica la pagina e, se necessario, riapri la lista.";
  if (error?.code === "invalid_credentials" || /Invalid login credentials/i.test(message)) return "Email o password non corrette. Controllale e riprova.";
  if (error?.code === "email_not_confirmed") return "Conferma l’indirizzo email usando il messaggio ricevuto, poi accedi di nuovo.";
  if (error?.code === "weak_password") return "Scegli una password più lunga, con lettere e numeri.";
  if (/rate.?limit|too many requests/i.test(message) || error?.code === "over_request_rate_limit") return "Hai fatto diversi tentativi in poco tempo. Attendi qualche minuto e riprova.";
  if (/failed to fetch|network|load failed|timeout|timed out/i.test(message)) return "La connessione con il sito si è interrotta. Controlla Internet e riprova. Prima di ripetere un salvataggio, ricarica la pagina per verificare se è riuscito.";
  return fallback;
}
