# Documenti per aziende

Il menu **DDT e consegne** permette di creare bozze, modificarle, emettere documenti, consultare lo storico, annullare con motivo e scaricare/stampare il PDF. **Aziende** gestisce anagrafiche, indirizzi di consegna e disponibilità per nuovi documenti. **Dati officina** configura l’emittente.

Prima della prima emissione compilare dati fiscali e indirizzo dell’officina, verificare modalità d’uso con il referente amministrativo e confermare la verifica nelle impostazioni. Una modifica ai dati dell’emittente richiede una nuova conferma. I dati incompleti dell’azienda consentono la bozza ma impediscono l’emissione.

I ricambi e le prestazioni si cercano nel catalogo esistente. La scheda prodotto contiene la tipologia Ricambio/Merce oppure Prestazione/Manodopera. Le quantità supportano tre decimali, prezzi e sconti due. I prezzi sono **IVA inclusa** e non viene aggiunta automaticamente alcuna aliquota. Gli sconti sono una singola percentuale per riga. I servizi possono utilizzare ore o un’altra unità del catalogo.

Un documento con beni è denominato DDT; un documento di sole prestazioni è denominato Documento di lavoro/consegna. Non costituisce fattura e non comporta invio fiscale automatico. I veicoli sono facoltativi. Il guasto, l’immatricolazione e la revisione non sono richiesti.

**Come concordato, i documenti non muovono il magazzino.** Le liste ordini e le rettifiche continuano a gestirlo.

## Numerazione e storico

La bozza non ha numero. All’emissione viene assegnato un progressivo atomico per anno e tipo (DDT/LAV), senza duplicati nei tentativi ripetuti. Il numero di un documento annullato non viene riutilizzato. Una data futura o precedente all’ultimo documento emesso nella stessa serie viene segnalata. Le bozze proteggono dalle modifiche contemporanee tramite versione.

I documenti emessi conservano snapshot di cliente, officina, veicolo, righe, prezzi e totali. Modificare o eliminare aziende/prodotti non cambia i contenuti storici. Un documento emesso non è modificabile né eliminabile dall’operatore: si può annullare indicando il motivo, conservando numero e dati. Le bozze possono essere eliminate.

I dati restano nel database; i PDF vengono generati da questi snapshot e sono scaricabili dal sito, con anteprima e paginazione. Lo stesso PDF si stampa in due copie. Questa conservazione applicativa non equivale a un servizio di conservazione fiscale a norma: modalità e tempi vanno stabiliti con l’amministrazione.

## Verifiche amministrative

Confermare prima dell’utilizzo reale causali, soggetti e incaricato del trasporto, indirizzo di destinazione, data/ora, natura/quantità e unità dei beni, trattamento dei documenti di sole prestazioni, prezzi lordi, eventuali regimi IVA particolari e politica di conservazione/correzione. Sono predisposti i campi; non si presume che tutti i casi fiscali siano identici.

Riferimenti consultati: [DPR 472/1996 su Normattiva](https://www.normattiva.it/atto/caricaDettaglioAtto?atto.codiceRedazionale=096G0487&atto.dataPubblicazioneGazzetta=1996-09-12&tipoDettaglio=originario), [Agenzia delle Entrate: documentazione per beni e prestazioni](https://www1.agenziaentrate.gov.it/servizi/scadenzario/main.php/main.php?chi=31&come=76&cosa=898&entroil=15-11-2019&op=4&vista=1).

## Implementazione e test

Stack esistente Next.js/React/Supabase. Le funzioni del database convalidano i dati, calcolano e arrotondano in `numeric` e gestiscono emissione/numerazione in transazione. Il calcolo immediato nell’interfaccia usa interi BigInt per evitare errori da float. La vista documenti restituisce il totale come testo per mantenere precisione anche negli importi grandi. RLS e privilegi impediscono scritture dirette sui documenti e accesso anonimo. Le RPC autorizzate usano SECURITY DEFINER con accesso autenticato esplicito e search_path fissato; ciò è intenzionale per impedire di aggirare emissione e immutabilità con scritture dirette. Le autorizzazioni riusano il modello esistente degli operatori autenticati.

Migrazioni: `20261011104948_delivery_documents.sql` , `20261011132917_delivery_validation_guards.sql` e `20261011133640_delivery_trigger_compatibility.sql`. Moduli: `components/ddt`, `lib/ddt`, `types/ddt.ts`. Catalogo e registro sono riutilizzati.

Test `scripts/test-ddt.cjs`: calcoli esatti, zero, sconto 100%, arrotondamento al centesimo, input errati e PDF normale/multipagina. `scripts/test-ddt.sql`: ricambi/prestazioni, snapshot, emissione ripetibile, protezione delle bozze, annullamento, dati mancanti, catalogo/clienti eliminati e autorizzazioni; dati sintetici dentro transazione annullata. `scripts/test-inventory-ui.cjs`: flusso nel browser, errori italiani, modifica bozza, download reale del PDF, sola prestazione, annullamento, aziende e layout mobile. Tutte le richieste Supabase del browser sono simulate.

Il facsimile fornito è stato usato solo come riferimento di impaginazione. Nessuno dei suoi dati personali/fiscali è stato inserito nel codice o nei test. Il font Noto Sans è distribuito con la licenza OFL.
