# Guida: Sistema di Prenotazione senza SMTP

## Configurazione Senza Email

Il sistema di prenotazione può funzionare perfettamente **senza SMTP**. Ecco cosa succede:

### Cosa Funziona Senza SMTP:
✅ **Prenotazioni**: Gli utenti possono prenotare tavoli e sdraio  
✅ **Pagamenti**: Stripe funziona normalmente  
✅ **Database**: Le prenotazioni vengono salvate correttamente  
✅ **Disponibilità**: I dati di disponibilità vengono aggiornati  
✅ **Frontend**: Tutto l'interfaccia utente funziona

### Cosa NON Funziona Senza SMTP:
❌ **Email di conferma**: Gli utenti non ricevono email  
❌ **Email al proprietario**: Non arriva notifica al gestore  
❌ **SMS**: Non vengono inviati messaggi (se configurati)

## Configurazione Consigliata

### Opzione 1: Rimuovere completamente SMTP
Nel file `backend/.env`, **non impostare** nessuna variabile SMTP:

```env
# LASCIA VUOTO - Non configurare SMTP
# SMTP_HOST=
# SMTP_PORT=
# SMTP_USER=
# SMTP_PASS=
# FROM_EMAIL=
# OWNER_EMAIL=

# Configurazione base necessaria
STRIPE_SECRET_KEY=sk_test_xxx
MONGO_URI=mongodb://localhost:27017/lido
PORT=3000
```

### Opzione 2: Commentare le variabili SMTP
```env
# SMTP_HOST=smtp.gmail.com
# SMTP_PORT=587
# SMTP_USER=tuoindirizzo@gmail.com
# SMTP_PASS=la_tua_password
# FROM_EMAIL=tuoindirizzo@gmail.com
# OWNER_EMAIL=isolalido@outlook.com

STRIPE_SECRET_KEY=sk_test_xxx
MONGO_URI=mongodb://localhost:27017/lido
PORT=3000
```

## Alternative Semplici per le Notifiche

### 1. **WhatsApp Business**
- Gli utenti possono contattare direttamente via WhatsApp
- Link: `https://wa.me/393334993469`
- Più immediato ed economico delle email

### 2. **Telegram Bot**
- Crea un bot Telegram per le notifiche
- Più semplice da configurare di SMTP
- Gratuito e immediato

### 3. **Dashboard Amministratore**
- Crea una semplice pagina web per vedere le prenotazioni
- Accesso: `https://backend-two-phi-89.vercel.app/api/booking/lista`
- Visualizza tutte le prenotazioni in tempo reale

### 4. **Google Sheets**
- Collega il backend a Google Sheets
- Ogni prenotazione viene registrata automaticamente
- Facile da monitorare e condividere

## Verifica Funzionamento

Dopo aver rimosso SMTP:

1. **Controlla i log del backend:**
   ```
   [MAILER] SMTP credentials not fully configured. Emails will not be sent.
   ```
   Questo messaggio è normale e indica che SMTP è disattivato.

2. **Testa una prenotazione:**
   - Vai su https://www.isolalido.it/html/prenotazioni.html
   - Scegli una data e fai una prenotazione
   - Il pagamento tramite Stripe funzionerà normalmente
   - La prenotazione verrà salvata nel database

3. **Verifica il database:**
   - Le prenotazioni saranno salvate correttamente
   - La disponibilità verrà aggiornata

## Vantaggi di Non Usare SMTP

### ✅ **Più Semplice**
- Nessuna configurazione complessa
- Nessun problema con password app
- Nessun rischio di blocco email

### ✅ **Più Economico**
- Nessun costo per servizi email
- Nessun limite di invio email

### ✅ **Più Affidabile**
- Nessun problema con provider email
- Nessun rischio di email nello spam

### ✅ **Più Veloce**
- Tempi di risposta più rapidi
- Meno dipendenze esterne

## Conclusione

Il sistema di prenotazione funziona perfettamente senza SMTP. Gli utenti possono prenotare normalmente, pagare tramite Stripe, e le prenotazioni vengono salvate correttamente. Per le notifiche, WhatsApp è molto più pratico ed economico delle email.

**Raccomandazione:** Procedi senza SMTP e usa WhatsApp per le comunicazioni con i clienti.