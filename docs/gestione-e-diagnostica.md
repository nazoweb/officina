# Gestione e diagnostica

Dal Magazzino si possono creare, modificare ed eliminare prodotti, gestire categorie e assegnarle a più prodotti. Una categoria può essere eliminata mantenendo i prodotti oppure eliminandoli tutti, con conferma esplicita. Le liste possono essere rinominate, riaperte, modificate ed eliminate scegliendo se restituire le quantità al magazzino. Le righe storiche degli ordini conservano codice, descrizione e quantità quando un prodotto viene eliminato.

Il barcode coincide sempre con il nostro codice. La scheda prodotto permette di modificare tutti i dati, rimuovere codici e prezzi, aggiungere listini e correggere la giacenza. Un aggiornamento concorrente della scheda richiede di riaprirla prima di salvare.

## Excel

L’importazione salva ogni prodotto in una transazione unica. Lo stesso codice identifica sempre lo stesso prodotto: reimportare il file non duplica i prodotti né la giacenza iniziale. Le colonne non abbinate e i prezzi vuoti mantengono i dati esistenti; per eliminarli utilizzare la scheda prodotto. I codici ripetuti nel file, le colonne abbinate a più campi e i numeri non validi bloccano l’importazione prima delle scritture. Le righe senza codice vengono segnalate e ignorate.

Un’interruzione tra due prodotti lascia salvati solo quelli già completati; il messaggio indica quanti. Il file può essere reimportato. L’intero file non costituisce una singola transazione.

## Errori e registro

`lib/user-errors.ts` traduce gli errori conosciuti e sostituisce gli errori sconosciuti con indicazioni in italiano. I dettagli SQL e i messaggi del server non sono mostrati all’operatore. Gli errori delle operazioni hanno un riferimento di otto caratteri.

Nel menu Registro attività si possono consultare le ultime 200 attività, filtrare i problemi e cercare un riferimento. La cronologia registra operazione, utente, sessione, pagina, esito, identificativi coinvolti e conteggi. I dettagli tecnici restano nella tabella `activity_events`, accessibili agli amministratori del database, senza esposizione al browser. Non si registrano password, token, note dei clienti o contenuti integrali dei file.

Se il registro non risponde, l’operazione dell’utente continua. Fino a 100 eventi vengono conservati nel browser, separati per utente, e ritentati alla successiva attività. La chiusura o pulizia del browser prima della riconnessione può perdere tali eventi. La registrazione client non costituisce una prova fiscale o un audit inviolabile. Non comprende errori avvenuti prima dell’accesso.

Per assistenza: cercare il riferimento e usare sessione/utente per ricostruire gli eventi precedenti. L’amministratore può recuperare il dettaglio tecnico con una query parametrizzata sulla colonna `id`; evitare di condividere dettagli tecnici con il cliente.

## Verifiche

- `node scripts/test-inventory-import.cjs`: file Excel, numeri italiani, prezzi zero, colonne e codici duplicati, quantità errate e traduzione degli errori.
- `scripts/test-inventory-management.sql`: CRUD, categorie, giacenze, snapshot storici, blocco delle liste chiuse e salvataggio atomico. Usa dati sintetici dentro una transazione annullata.
- `scripts/test-inventory-edge.sql`: stesso file/codice, dati assenti, prezzi zero, errori a metà salvataggio, accesso al registro e dettagli tecnici protetti. Transazione annullata.
- `scripts/test-inventory-ui.cjs`: sito locale su porta 3100, Chrome e Playwright (`OFFICINA_PLAYWRIGHT` può indicare il modulo disponibile). Tutte le richieste Supabase sono simulate. Copre CRUD, scanner, importazioni ripetute, errori comprensibili, ripristino del registro, accesso e layout desktop/mobile.
- `tsc --noEmit --incremental false` e build Next.js.

Non si usano dati personali del cliente nei test e non si eliminano prodotti reali.
