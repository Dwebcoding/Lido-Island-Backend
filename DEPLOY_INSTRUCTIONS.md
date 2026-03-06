# Istruzioni per il Deploy su Vercel

## Modifiche da Deployare

Ho risolto i problemi di CORS e 404 error che impedivano al frontend di accedere ai dati di disponibilità del backend. Ecco cosa è stato corretto:

### 1. Fix Route Backend (`backend/server.js`)
- Corretto l'import/export delle rotte di prenotazione
- Le rotte ora vengono registrate correttamente come middleware

### 2. Configurazione Static File (`backend/server.js`)  
- Aggiunta la gestione per i file HTML nella cartella `/html`
- Ora i file come `prenotazioni.html` sono accessibili tramite `http://localhost:3000/html/prenotazioni.html`

## Istruzioni per il Deploy

### Opzione 1: Deploy da GitHub (Consigliato)
1. **Commit delle modifiche:**
   ```bash
   git add .
   git commit -m "Fix CORS and 404 errors - Booking system now works with Vercel"
   git push origin main
   ```

2. **Vercel deploy automatico:**
   - Vercel rileverà automaticamente il nuovo commit
   - Il deploy avverrà in pochi minuti
   - L'URL aggiornato sarà disponibile su: https://vercel.com/dwebcodings-projects/lido-island-backend

### Opzione 2: Deploy Manuale da Vercel Dashboard
1. Accedi a [Vercel Dashboard](https://vercel.com/dashboard)
2. Seleziona il progetto "lido-island-backend"
3. Clicca su "Deployments" → "New Project" → "Import Git Repository"
4. Seleziona il repository GitHub aggiornato
5. Configura le variabili d'ambiente se necessario
6. Clicca su "Deploy"

### Opzione 3: Deploy da CLI Vercel
1. **Installa Vercel CLI:**
   ```bash
   npm install -g vercel
   ```

2. **Login:**
   ```bash
   vercel login
   ```

3. **Deploy:**
   ```bash
   cd backend
   vercel --prod
   ```

## Verifica del Deploy

Dopo il deploy, verifica che tutto funzioni correttamente:

### Test Endpoint API
```bash
# Test tavoli disponibili
curl "https://backend-two-phi-89.vercel.app/api/booking/tavoli-disponibili?date=2026-04-06"

# Test tavoli occupati  
curl "https://backend-two-phi-89.vercel.app/api/booking/tavoli-occupati?date=2026-04-06"

# Test sdraio disponibili
curl "https://backend-two-phi-89.vercel.app/api/booking/sdraio-disponibili?date=2026-04-06"

# Test ombrelloni disponibili
curl "https://backend-two-phi-89.vercel.app/api/booking/ombrelloni-disponibili?date=2026-04-06"
```

### Test Frontend
Accedi a: https://www.isolalido.it/html/prenotazioni.html

Verifica che:
- [ ] Non ci siano errori CORS nella console del browser
- [ ] Non ci siano errori 404 per gli endpoint API
- [ ] I dati di disponibilità vengano caricati correttamente
- [ ] Il sistema di prenotazione funzioni correttamente

## Risultato Atteso

Dopo il deploy, il sistema di prenotazione dovrebbe:
- ✅ Caricare correttamente i dati di disponibilità senza errori
- ✅ Consentire agli utenti di prenotare tavoli e sdraio
- ✅ Processare i pagamenti tramite Stripe
- ✅ Funzionare completamente in produzione su Vercel

## Supporto

Se incontri problemi durante il deploy:
1. Controlla la console di Vercel per eventuali errori di build
2. Verifica che tutte le variabili d'ambiente siano configurate correttamente
3. Controlla la console del browser per errori JavaScript
4. Testa gli endpoint API manualmente come indicato sopra