# Carrello vendita, scontrini interni e riordino

## Vendere al banco

Aprire **Carrello vendita**. Ogni operatore ha un proprio carrello persistente, recuperato anche ricaricando la pagina. Le scansioni di un codice completo aggiungono un pezzo; scansioni ripetute aumentano la stessa riga. Un codice ambiguo o parziale richiede di scegliere il prodotto. Nome cliente, azienda, pagamento e note si salvano dal pulsante dedicato oppure alla chiusura.

Modificare quantità, prezzo di vendita IVA inclusa e sconto percentuale con **Salva riga**. Rimuovere un articolo dal carrello non muove il magazzino. Le quantità dei ricambi sono intere; le ore delle prestazioni ammettono tre decimali. Un listino mancante propone zero e richiede di controllare il prezzo prima di confermare.

**Chiudi vendita** salva uno scontrino interno numerato per anno, con cliente, operatore, data e ora italiana, righe, prezzi, sconti e totale. Soltanto in questa transazione vengono scaricati i ricambi e create le voci da riordinare. Le prestazioni non muovono il magazzino e non entrano nel riordino. Le giacenze negative sono gestite come nel magazzino esistente.

**Chiudi ed emetti DDT** fa anche l'emissione del documento collegato, utilizzando l'azienda selezionata, i dati officina e le verifiche già previste dai DDT. Se l'emissione fallisce, la vendita resta aperta e non avvengono scarichi o inserimenti nel riordino. Una vendita chiusa con azienda può anche emettere il DDT successivamente dal dettaglio, senza un altro scarico. Con sole prestazioni si emette il documento di lavoro/consegna previsto dal portale.

Dopo la chiusura, **Nuova vendita** apre un carrello vuoto. **Abbandona carrello** elimina soltanto il carrello non confermato.

## Storico vendite

Lo storico contiene tutte le vendite confermate e annullate. Si cerca per numero, cliente, prodotto, operatore e intervallo di date. I dati dello scontrino rimangono quelli della chiusura, anche se il catalogo cambia o un prodotto viene eliminato. È disponibile il PDF dello scontrino interno, da scaricare o aprire per stampare. Il prezzo d'acquisto non fa parte delle righe salvate o stampate.

Una vendita chiusa non si riapre e non si elimina: **Annulla vendita** richiede un motivo, lascia il documento nello storico e consente di scegliere se restituire i ricambi al magazzino. Annulla anche l'eventuale DDT collegato ancora emesso. La lista da riordinare non viene modificata: le sue voci segnalano la vendita annullata e rimangono da verificare manualmente. Una ristampa storica conserva invece lo stato che aveva al momento del salvataggio.

## Lista permanente Da riordinare

Ogni voce indica codice, descrizione, quantità, data e ora della vendita, numero dello scontrino, fornitore e codice fornitore. Le vendite separate mantengono righe separate, per conservare data e provenienza. Sono visibili il numero di voci e il totale dei pezzi; si può filtrare per articolo o fornitore.

**Stampa lista e salva nello storico** acquisisce l'intera lista corrente in un'unica istantanea, anche se è attivo un filtro. Apre quindi la copia storica con anteprima PDF, download e ristampa. Preparare una stampa salva la copia anche se successivamente si annulla la finestra di stampa. Ristampare una copia esistente non crea un altro storico e non dipende dal catalogo attuale.

**La stampa non svuota la lista.** Solo la selezione delle voci e **Elimina dalla lista**, con conferma, le rimuove dalla lista corrente. Tale rimozione non cambia magazzino, vendite o stampe precedenti. Non esistono scadenze o svuotamenti automatici. Le rimozioni conservano operatore e data nel database.

## Compatibilità e verifiche

Le precedenti **Liste ordini** rimangono disponibili, con il loro scarico alla scansione. Il nuovo carrello è un flusso distinto: non registrare la medesima vendita anche in una lista ordini. Le vecchie liste non vengono trasformate retroattivamente in vendite.

Le nuove tabelle espongono agli operatori soltanto la lettura. Il carrello non confermato è leggibile e modificabile solo dal suo operatore; scontrini chiusi, riordini e stampe sono condivisi nell'officina. Le mutazioni passano da una funzione privata, con controlli dell'accesso, versioni delle schede, blocchi transazionali e chiavi di idempotenza per scansioni e stampe. Chiusure e annullamenti ripetuti non duplicano i movimenti.

- `scripts/test-sales.sql`: operatore sintetico e dati di prova in transazione annullata; scansioni, versioni, totali, ruoli, stock, annullamenti, DDT simultaneo e successivo, isolamento dei carrelli, stampe immutabili e rimozione manuale.
- `scripts/test-sales-ui.cjs`: intero percorso nel browser con Supabase simulato, compresi PDF e uso mobile; nessun dato reale modificato.
- `scripts/test-sales-pdf.cjs`: PDF multipagina e dati storici, senza prezzi d'acquisto.
- TypeScript e build Next.js.
