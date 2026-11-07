# Modifica, salvataggio e navigazione

Le azioni frequenti dei prodotti sono visibili: Modifica, Rettifica giacenza nel magazzino e Aggiungi alla vendita nella ricerca. Eliminazione e relative conferme restano separate.

I moduli prodotto, DDT e impostazioni hanno una barra persistente con salvataggio, ritorno e stato delle modifiche. La modifica prodotto torna alla pagina di provenienza. Ricerca e filtri del magazzino vengono conservati nella sessione del browser. I moduli segnalano le modifiche non salvate prima di seguire un collegamento o chiudere/ricaricare la pagina; il browser Indietro/Avanti non è intercettato.

Il carrello ha un solo Salva carrello. Righe e dati cliente vengono salvati anche prima di aggiungere articoli o confermare la vendita. Il totale segue subito i campi modificati. Tutte le righe vengono validate prima di inviare aggiornamenti, che utilizzano in sequenza la versione restituita dal server. In caso di errore restano da salvare le righe non confermate.

La nuova azienda si può creare dal DDT o dal carrello senza cambiare pagina. Le bozze DDT hanno Modifica nell’elenco; i dati facoltativi del veicolo seguono i ricambi. Assegnazione e rimozione della categoria sono azioni distinte; la rinomina avviene sulla riga.

## Verifiche

- `npm run build`
- `./node_modules/.bin/tsc --noEmit --incremental false`
- `node scripts/test-cart-drafts.cjs`
- `node scripts/test-ddt.cjs`
- `node scripts/test-inventory-import.cjs`

Verifica manuale desktop in Dia con backend simulato: comandi diretti, conservazione della ricerca, modifica DDT dall’elenco, apertura e annullamento del dialogo azienda, totale aggiornato, conferma vendita da 480 euro con salvataggio delle quantità e aggiornamento delle giacenze, avviso di uscita con annullamento e scarto della bozza.

Le prove non modificano dati reali. La disposizione per finestre strette e la creazione azienda contro il backend reale richiedono ulteriori verifiche.
