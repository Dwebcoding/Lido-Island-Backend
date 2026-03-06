# Configurazione Vercel - Disabilita Deployment Protection

Per disabilitare la protezione del deployment e rendere il backend pubblicamente accessibile:

## Opzione 1: Dashboard Vercel (Consigliato)

1. Vai su https://vercel.com/dashboard
2. Seleziona il progetto "backend"
3. Vai su Settings → Deployment Protection
4. Disabilita "Vercel Authentication"
5. Salva le modifiche

## Opzione 2: CLI Vercel

```bash
cd backend
npx vercel project settings deployment-protection off
```

## Verifica

Dopo aver disabilitato la protezione, testa:

```bash
curl https://backend-two-phi-89.vercel.app/api/ping
```

Dovresti ricevere una risposta JSON senza redirect di autenticazione.

## URL Deployment Correnti

- Production: https://backend-two-phi-89.vercel.app
- Latest: https://backend-95rrnuo09-dwebcodings-projects-ab095673.vercel.app

## Note

Il backend è configurato con CORS per accettare richieste da:
- https://www.isolalido.it
- https://isolalido.it
