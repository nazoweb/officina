# Controllo giornaliero Supabase su Vercel

Il cron configurato in `vercel.json` richiama `/api/cron/supabase-keepalive`
ogni giorno alle 08:00 UTC. Sul piano Hobby Vercel può eseguirlo durante
l'ora successiva: in Italia circa 10–11 in estate, 9–10 in inverno.
È eseguito sul deployment Production, anche con computer e browser spenti.

## Configurazione

- Le due variabili Supabase esistenti devono essere presenti in Production.
- Aggiungere `CRON_SECRET` come variabile segreta di Production: almeno
  32 caratteri casuali. Non inserirla nel repository o in variabili NEXT_PUBLIC.
- Distribuire su Production dopo avere configurato la variabile.
- Controllare Settings → Cron Jobs e usare Run per verificare la prima chiamata;
  nei log deve comparire `Supabase keepalive: database responded successfully`.

Il controllo verifica il token inviato automaticamente da Vercel ed esegue
una richiesta HEAD sulla tabella products tramite la Data API, con la sola
chiave pubblicabile e le autorizzazioni RLS anonime già esistenti. Non restituisce
prodotti, non legge sessioni degli operatori e non scrive dati. Nessuna chiave
amministrativa né modifica a Supabase è necessaria.

Risposte: 200 riuscito; 401 token errato; 503 configurazione mancante;
502 database non raggiungibile o errore API. Le risposte non vengono memorizzate
in cache. Vercel non riprova automaticamente i cron falliti: verificare i log.

Il controllo genera attività ma non garantisce la disponibilità del piano
Supabase Free né ripristina un progetto già sospeso. Restano applicabili le quote
gratuite Vercel/Supabase. Per disattivarlo, rimuovere la voce crons e ridistribuire.

Test locale: `node scripts/test-supabase-keepalive.cjs`.

Fonti: https://vercel.com/docs/cron-jobs/manage-cron-jobs e
https://vercel.com/docs/cron-jobs/usage-and-pricing.
