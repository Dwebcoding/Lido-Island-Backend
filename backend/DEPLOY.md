# Deploy Backend su Vercel

## Setup Iniziale

1. Installa Vercel CLI (se non già installato):
```bash
npm install -g vercel
```

2. Login a Vercel:
```bash
vercel login
```

## Deploy

Dalla cartella `backend`, esegui:

```bash
vercel --prod
```

## Configurazione Variabili d'Ambiente

Nel dashboard Vercel, configura le seguenti variabili:

- `MONGO_URI` - URI MongoDB Atlas
- `STRIPE_SECRET_KEY` - Chiave segreta Stripe
- `STRIPE_WEBHOOK_SECRET` - Secret per webhook Stripe
- `EMAIL_USER` - Email per invio notifiche
- `EMAIL_PASS` - Password email
- `NODE_ENV` - `production`

## Mantenere il Backend Sempre Attivo

Vercel serverless functions sono sempre disponibili. Non c'è bisogno di configurazioni aggiuntive per mantenerle attive.

## CORS Configurato

Il backend è configurato per accettare richieste da:
- https://www.isolalido.it
- https://isolalido.it
- http://localhost:3000 (sviluppo)

## Verifica Deploy

Testa l'endpoint ping:
```bash
curl https://backend-atrfva4ai-dwebcodings-projects-ab095673.vercel.app/api/ping
```
