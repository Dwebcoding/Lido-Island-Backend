# Guida Completa ai Test del Sistema Prenotazioni

## Panoramica

Questa guida descrive come eseguire i test completi per il sistema di prenotazione tavoli, sdraio e ombrelloni di Lido Island.

## File Test

### 1. `test-booking-comprehensive.html`
**Suite di test completa** - Interfaccia web interattiva per testare tutti gli aspetti del sistema.

### 2. `test-booking.html`
**Test API base** - Test semplice per verificare la connettività degli endpoint API.

### 3. `test-vercel-booking.html`
**Test deployment Vercel** - Test specifici per ambienti Vercel.

## Prerequisiti

- Backend Node.js in esecuzione
- Accesso al database MongoDB
- Configurazione Stripe (opzionale per alcuni test)
- Configurazione SMTP (opzionale per alcuni test)

## Configurazione Test

### Configurazione Base

1. **URL API Backend**: Inserisci l'URL del tuo backend (es: `http://localhost:3000`)
2. **Data Test**: Seleziona una data futura disponibile
3. **Email Test**: Email per testare le notifiche
4. **Telefono Test**: Numero per testare WhatsApp

### Configurazione Avanzata

```javascript
// Configurazione di default
config = {
    apiBase: 'http://localhost:3000',
    testDate: '2026-04-06', // Data di esempio
    testEmail: 'test@example.com',
    testPhone: '+393331234567'
}
```

## Tipi di Test

### 🔍 Test API Backend

#### Connessione API
- **Scopo**: Verifica che il backend sia raggiungibile
- **Endpoint**: `GET /api/booking/ping`
- **Aspettativa**: Risposta 200 OK

#### Disponibilità Tavoli
- **Scopo**: Verifica endpoint tavoli-disponibili
- **Endpoint**: `GET /api/booking/tavoli-disponibili?date=YYYY-MM-DD`
- **Aspettativa**: Risposta JSON con numero tavoli disponibili

#### Disponibilità Sdraio
- **Scopo**: Verifica endpoint sdraio-disponibili
- **Endpoint**: `GET /api/booking/sdraio-disponibili?date=YYYY-MM-DD`
- **Aspettativa**: Risposta JSON con numero sdraio disponibili

#### Disponibilità Ombrelloni
- **Scopo**: Verifica endpoint ombrelloni-disponibili
- **Endpoint**: `GET /api/booking/ombrelloni-disponibili?date=YYYY-MM-DD`
- **Aspettativa**: Risposta JSON con numero ombrelloni disponibili

#### Statistiche Prenotazioni
- **Scopo**: Verifica calcolo statistiche
- **Endpoint**: `GET /api/booking/stats?date=YYYY-MM-DD`
- **Aspettativa**: Risposta JSON con conteggi e importi

#### Lista Prenotazioni
- **Scopo**: Verifica endpoint lista prenotazioni
- **Endpoint**: `GET /api/booking/lista?limit=N&date=YYYY-MM-DD&status=active`
- **Aspettativa**: Risposta JSON con elenco prenotazioni

### 💳 Test Pagamenti Stripe

#### Configurazione Stripe
- **Scopo**: Verifica che Stripe sia configurato correttamente
- **Endpoint**: `POST /api/payment/create-checkout-session`
- **Aspettativa**: Creazione sessione pagamento o messaggio di disabilitazione

#### Creazione Sessione Pagamento
- **Scopo**: Verifica creazione sessioni Stripe
- **Endpoint**: `POST /api/payment/create-checkout-session`
- **Aspettativa**: URL sessione Stripe valido

#### Webhook Stripe
- **Scopo**: Verifica endpoint webhook
- **Endpoint**: `POST /api/payment/webhook`
- **Aspettativa**: Risposta 200 OK o 400 (per firma mancante)

### 📧 Test Notifiche

#### Configurazione Email
- **Scopo**: Verifica configurazione SMTP
- **Endpoint**: `POST /api/test-email`
- **Aspettativa**: Email inviata o configurazione non disponibile

#### Configurazione WhatsApp
- **Scopo**: Verifica configurazione WhatsApp
- **Endpoint**: `GET /api/whatsapp/test`
- **Aspettativa**: Configurazione attiva o non disponibile

### 🛡️ Test Sicurezza

#### Validazione Input
- **Scopo**: Verifica protezione da input malevoli
- **Test**: Invio dati XSS e SQL injection
- **Aspettativa**: Rifiuto richiesta (400 Bad Request)

#### Prevenzione XSS
- **Scopo**: Verifica protezione da attacchi XSS
- **Test**: Payload XSS negli header
- **Aspettativa**: Rifiuto richiesta (400/403)

#### Gestione Errori
- **Scopo**: Verifica gestione errori appropriata
- **Test**: Endpoint inesistenti
- **Aspettativa**: Risposta 404 con messaggio appropriato

#### Rate Limiting
- **Scopo**: Verifica limitazione richieste
- **Test**: Multiple richieste simultanee
- **Aspettativa**: Alcune richieste limitate (429)

#### Sicurezza API
- **Scopo**: Verifica header di sicurezza
- **Test**: Header Content-Type e CORS
- **Aspettativa**: Header appropriati presenti

### ⚡ Test Prestazioni

#### Tempi di Risposta
- **Scopo**: Misura prestazioni endpoint critici
- **Test**: Misurazione tempo risposta
- **Aspettativa**: Tempo medio < 1000ms

#### Test Carico Sistema
- **Scopo**: Verifica resistenza a carico elevato
- **Test**: 50 richieste simultanee
- **Aspettativa**: 90% successo, tempo medio accettabile

#### Concorrenza
- **Scopo**: Verifica gestione prenotazioni concorrenti
- **Test**: Sessioni pagamento simultanee
- **Aspettativa**: Sessioni create senza conflitti

### 🔄 Test Integrazione Completa

#### Flusso Prenotazione Completo
- **Scopo**: Test end-to-end completo
- **Passaggi**:
  1. Verifica disponibilità
  2. Creazione sessione pagamento
  3. Simulazione webhook
  4. Verifica notifiche
- **Aspettativa**: Tutti i passaggi completati

#### Test Cancellazione
- **Scopo**: Verifica processo cancellazione
- **Endpoint**: `PATCH /api/booking/cancella`
- **Aspettativa**: Risposta 404 o 403 appropriata

## Esecuzione Test

### Test Singoli
1. Apri `test-booking-comprehensive.html` nel browser
2. Configura l'URL API backend
3. Seleziona un test specifico
4. Clicca il pulsante "Test"

### Suite Completa
1. Configura tutti i parametri
2. Clicca "Esegui Tutti i Test"
3. Attendi completamento (5-10 minuti)
4. Visualizza report finale

### Test Critici Solo
1. Clicca "Test Critici Solo"
2. Esegue solo test essenziali (5 minuti)
3. Ideale per deployment rapidi

## Interpretazione Risultati

### Stati Test
- ✅ **Successo**: Test completato correttamente
- ❌ **Errore**: Test fallito, problema critico
- ⚠️ **Attenzione**: Test con potenziali problemi
- ⏳ **In Attesa**: Test non ancora eseguito

### Metriche Importanti
- **Tasso di Successo**: Percentuale test superati
- **Tempo Medio Risposta**: Prestazioni sistema
- **Fallimenti Carico**: Scalabilità sistema
- **Errori Sicurezza**: Vulnerabilità critiche

## Risoluzione Problemi

### Connessione API Fallita
- Verifica backend in esecuzione
- Controlla URL API corretto
- Verifica firewall/rete

### Test Stripe Falliti
- Controlla STRIPE_SECRET_KEY nel backend
- Verifica ambiente test vs produzione
- Controlla configurazione webhook

### Test Email Falliti
- Verifica SMTP_HOST, SMTP_USER, SMTP_PASS
- Controlla FROM_EMAIL e OWNER_EMAIL
- Verifica password app Outlook

### Test WhatsApp Falliti
- Controlla configurazione Twilio
- Verifica credenziali WhatsApp Business
- Controlla numero telefono formattato correttamente

### Errori Validazione
- Verifica logica validazione input
- Controlla sanitizzazione dati
- Testa con dati realistici

## Best Practice

### Prima dei Test
1. Assicurati backend in esecuzione
2. Database MongoDB accessibile
3. Configurazione ambiente corretta
4. Backup dati esistenti

### Durante i Test
1. Monitora log backend
2. Controlla stato database
3. Verifica email/WhatsApp inviati
4. Annota anomalie

### Dopo i Test
1. Pulisci dati di test
2. Analizza report risultati
3. Risolvi errori critici
4. Documenta problemi trovati

## Report e Documentazione

### Report Automatico
- Generato dopo ogni suite completa
- Include metriche e dettagli test
- Esportabile in JSON

### Log Test
- Tutti i risultati salvati localmente
- Timestamp per ogni test
- Dettagli errore quando disponibili

### Monitoraggio Continuo
- Eseguire test regolarmente
- Prima di ogni deployment
- Dopo modifiche al codice

## Configurazione Ambiente

### Sviluppo Locale
```bash
# Backend
npm install
npm start

# Database
mongod --dbpath ./data

# Test
open test-booking-comprehensive.html
```

### Produzione
```bash
# Verifica variabili ambiente
echo $MONGO_URI
echo $STRIPE_SECRET_KEY
echo $SMTP_HOST

# Esegui test critici
# Verifica report
```

## Supporto e Manutenzione

### Aggiornamento Test
- Mantenere test aggiornati con codice
- Aggiungere test per nuove funzionalità
- Rimuovere test obsoleti

### Estensione Test
- Aggiungere test per nuovi endpoint
- Implementare test integrazione complessi
- Aggiungere test performance specifici

### Automazione
- Integrare con CI/CD pipeline
- Eseguire test automaticamente
- Notifiche su fallimenti critici

## Contatti

Per supporto sui test:
- Verifica documentazione esistente
- Controlla log errori specifici
- Testa singoli componenti
- Contatta team sviluppo per problemi complessi