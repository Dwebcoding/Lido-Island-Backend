# Deploy Correzioni Backend - Lido Island

## Panoramica

Questo documento descrive le correzioni apportate al backend per risolvere i problemi CORS e rendere il sistema di prenotazioni funzionante in produzione su Vercel.

## Problemi Identificati

1. **Endpoint API non raggiungibili**: Gli endpoint `/api/booking/*` non erano inclusi nella configurazione Vercel
2. **CORS non configurato correttamente**: La configurazione CORS era incompleta per l'ambiente di produzione
3. **Route mancanti**: Alcuni endpoint non erano mappati correttamente nelle rotte Vercel

## Correzioni Apportate

### 1. Aggiornamento `backend/vercel.json`

**Problema**: Gli endpoint `/api/booking/*` non erano inclusi nelle rotte Vercel.

**Soluzione**: Aggiunta esplicita delle rotte per gli endpoint di booking:

```json
{
  "version": 2,
  "builds": [
    { "src": "api/ping.mjs", "use": "@vercel/node" },
    { "src": "api/payment/create-checkout-session.mjs", "use": "@vercel/node" },
    { "src": "api/server.js", "use": "@vercel/node" }
  ],
  "routes": [
    { "src": "/api/ping", "methods": ["GET"], "dest": "/api/ping.mjs" },
    { "src": "/api/payment/create-checkout-session", "methods": ["POST", "OPTIONS"], "dest": "/api/payment/create-checkout-session.mjs" },
    { "src": "/api/payment/webhook", "methods": ["POST"], "dest": "/api/server.js" },
    { "src": "/api/booking/(.*)", "methods": ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"], "dest": "/api/server.js" },
    { "src": "/api/(.*)", "methods": ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"], "dest": "/api/server.js" }
  ]
}
```

### 2. Miglioramento CORS in `backend/api/server.js`

**Problema**: Configurazione CORS incompleta per l'ambiente di produzione.

**Soluzione**: Configurazione CORS completa con gestione dinamica delle origini:

```javascript
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = [
      'https://www.isolalido.it',
      'https://isolalido.it',
      'http://localhost:3000',
      'http://127.0.0.1:5500',
      'http://localhost:5500'
    ];
    
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.warn('[CORS] Origine non consentita:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type', 
    'Authorization', 
    'x-admin-key',
    'X-Requested-With',
    'Accept',
    'Origin'
  ],
  credentials: true,
  optionsSuccessStatus: 200,
  preflightContinue: false,
  maxAge: 86400
};
```

## Prossimi Passi per il Deploy

### 1. Deploy su Vercel

Per rendere effettive queste correzioni, è necessario deployare nuovamente il backend su Vercel:

```bash
# Nella cartella backend
cd backend
vercel --prod
```

Oppure tramite dashboard Vercel:
1. Accedi a https://vercel.com/dashboard
2. Seleziona il progetto "lido-island-backend"
3. Clicca su "Deploy"
4. Attendi il completamento del deploy

### 2. Verifica Deploy

Dopo il deploy, verifica che gli endpoint siano raggiungibili:

```bash
# Test endpoint tavoli disponibili
curl -UseBasicParsing "https://lido-island-backend.vercel.app/api/booking/tavoli-disponibili?date=2026-04-05"

# Test endpoint sdraio disponibili
curl -UseBasicParsing "https://lido-island-backend.vercel.app/api/booking/sdraio-disponibili?date=2026-04-05"

# Test endpoint ombrelloni disponibili
curl -UseBasicParsing "https://lido-island-backend.vercel.app/api/booking/ombrelloni-disponibili?date=2026-04-05"

# Test endpoint tavoli occupati
curl -UseBasicParsing "https://lido-island-backend.vercel.app/api/booking/tavoli-occupati?date=2026-04-05"
```

### 3. Test CORS

Verifica che gli header CORS siano correttamente impostati:

```bash
# Test con header Origin
curl -UseBasicParsing -Headers @{"Origin"="https://www.isolalido.it"} "https://lido-island-backend.vercel.app/api/booking/tavoli-disponibili?date=2026-04-05"
```

## Variabili d'Ambiente da Configurare

Assicurati che le seguenti variabili siano configurate in Vercel:

```bash
# Database
MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/lido

# Stripe
STRIPE_SECRET_KEY=sk_live_...

# Email
SMTP_HOST=smtp.gmail.com
SMTP_USER=tua-email@gmail.com
SMTP_PASS=tua-app-password
FROM_EMAIL=noreply@isolalido.it
OWNER_EMAIL=owner@isolalido.it

# Altre configurazioni
ALLOW_INSECURE_WEBHOOK=false
```

## Test Finali

Dopo il deploy, esegui i seguenti test:

1. **Test disponibilità tavoli**: Verifica che la pagina prenotazioni carichi correttamente i tavoli disponibili
2. **Test Stripe**: Verifica che la creazione della sessione di pagamento funzioni
3. **Test CORS**: Verifica che non ci siano errori CORS nella console del browser
4. **Test completo**: Prova a effettuare una prenotazione completa

## Risoluzione Problemi Comuni

### Errori CORS Persistono
- Verifica che il deploy sia completato
- Controlla che le variabili d'ambiente siano corrette
- Assicurati che l'URL del sito sia corretto (www.isolalido.it vs isolalido.it)

### Endpoint Non Raggiungibili
- Verifica che il deploy sia avvenuto correttamente
- Controlla i log di Vercel per errori
- Assicurati che MongoDB sia raggiungibile

### Stripe Non Funziona
- Verifica che STRIPE_SECRET_KEY sia impostata correttamente
- Controlla che le chiavi siano per l'ambiente live
- Verifica che l'endpoint webhook sia configurato correttamente

## Supporto

Per qualsiasi problema o domanda:
- Controlla i log di Vercel
- Verifica la connessione a MongoDB
- Controlla la console del browser per errori JavaScript
- Consulta la documentazione: `DEPLOY_INSTRUCTIONS.md`