# Integrazione WhatsApp per Template e Aggiornamento Prenotazioni

## Configurazione per Inviare Template via WhatsApp

### 1. **Configurazione Twilio per WhatsApp**
Nel file `backend/.env`, aggiungi le seguenti variabili:

```env
# Twilio per WhatsApp
TWILIO_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=yyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyy
TWILIO_FROM=whatsapp:+14155238886  # Numero WhatsApp Business di Twilio
```

### 2. **Aggiornamento del Mailer per WhatsApp**
Modificheremo il file `backend/services/mailer.js` per inviare i template via WhatsApp.

### 3. **Creazione di Template WhatsApp**
Creeremo versioni testuali dei template HTML per WhatsApp.

## Implementazione

### Passo 1: Creare Template WhatsApp

Creeremo due nuovi file per i template WhatsApp:

#### `backend/services/template_whatsapp_owner.txt`
```
🎉 NUOVA PRENOTAZIONE RICEVUTA!

👤 DATI CLIENTE:
• Nome: {{customer_name}}
• Email: {{customer_email}}
• Telefono: {{customer_phone}}
• ID Prenotazione: {{booking_id}}

📅 DATA PRENOTAZIONE: {{booking_date}}

📋 ARTICOLI PRENOTATI:
• Tavoli: {{tables_count}} x €8,00 = €{{tables_price}}
• Sdraio/Ombrelloni: {{chairs_count}} x €5,00 = €{{chairs_price}}

🍽️ NUMERI TAVOLI: {{table_numbers}}

📝 NOTE AGGIUNTIVE: {{booking_notes}}

💰 TOTALE: €{{total_price}}

Prenotazione ricevuta il: {{booking_timestamp}}

Isola Lido - Piscina e Relax per tutta la famiglia
📍 Via Rivolta, 20062 - Cassano d'Adda (MI)
📞 333-499-3469
📧 info@isolalido.it
```

#### `backend/services/template_whatsapp_customer.txt`
```
Conferma ricezione prenotazione

Ciao {{customer_name}},

Abbiamo ricevuto la tua prenotazione. Ecco il riepilogo:

• Numero prenotazione: {{booking_id}}
• Data: {{booking_date}}
• Tavoli: {{tables_count}}
• Sdraio/Ombrelloni: {{chairs_count}}
• Totale: €{{total_price}}

Ricevuta il: {{booking_timestamp}}

Grazie per aver scelto Isola Lido!
📞 333-499-3469
📧 info@isolalido.it
```

### Passo 2: Aggiornare il Mailer

Modificheremo `backend/services/mailer.js` per aggiungere funzioni WhatsApp:

```javascript
// Funzione per inviare template WhatsApp al proprietario
async function sendWhatsAppOwnerNotification({ booking = {}, amount = 0 }) {
    try {
        await twilioInitPromise;
        if (!twilioClient) return false;

        const tables_count = booking.tables || booking.tables_count || 0;
        const chairs_count = booking.chairs || booking.chairs_count || 0;
        const tables_price = booking.tables_price || (tables_count * 800);
        const chairs_price = booking.chairs_price || (chairs_count * 500);
        const total_price = amount || (tables_price + chairs_price);

        const vars = {
            customer_name: booking.name || booking.customer_name || '—',
            customer_email: booking.email || booking.customer_email || '—',
            customer_phone: booking.phone || booking.customer_phone || '—',
            booking_id: booking._id || booking.id || booking.booking_id || '—',
            booking_date: booking.date || booking.booking_date || '—',
            booking_notes: booking.notes || booking.booking_notes || '—',
            table_numbers: (booking.tableNumbers && Array.isArray(booking.tableNumbers) && booking.tableNumbers.length > 0) 
                ? booking.tableNumbers.join(', ') 
                : 'Nessun numero specificato',
            tables_count,
            chairs_count,
            tables_price: (typeof tables_price === 'number') ? (tables_price / 100).toFixed(2).replace('.', ',') : tables_price,
            chairs_price: (typeof chairs_price === 'number') ? (chairs_price / 100).toFixed(2).replace('.', ',') : chairs_price,
            total_price: (typeof total_price === 'number') ? (total_price / 100).toFixed(2).replace('.', ',') : total_price,
            booking_timestamp: new Date().toLocaleString('it-IT'),
        };

        // Leggi template WhatsApp
        const template = await fs.readFile(path.join(__dirname, 'template_whatsapp_owner.txt'), 'utf8');
        
        // Sostituisci variabili
        let message = template.replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (_, key) => {
            return typeof vars[key] !== 'undefined' && vars[key] !== null ? String(vars[key]) : '';
        });

        // Invia WhatsApp al proprietario
        const toPhone = process.env.OWNER_PHONE || 'whatsapp:+393334993469'; // Numero proprietario
        const fromTw = process.env.TWILIO_FROM;

        if (fromTw && toPhone) {
            await twilioClient.messages.create({
                body: message,
                from: fromTw,
                to: toPhone,
            });
            console.log('[WHATSAPP] Notifica proprietario inviata a', toPhone);
            return true;
        }
        return false;
    } catch (err) {
        console.error('[WHATSAPP] sendWhatsAppOwnerNotification error:', err);
        return false;
    }
}

// Funzione per inviare conferma WhatsApp al cliente
async function sendWhatsAppCustomerConfirmation({ to, booking = {}, amount = 0 }) {
    try {
        await twilioInitPromise;
        if (!twilioClient) return false;

        const name = booking.name || booking.customer_name || '';
        const bookingId = booking._id || booking.id || booking.booking_id || '';
        const total = formatCentsToEuro(amount || booking.amount || 0);
        const tables_count = booking.tables || booking.tables_count || 0;
        const chairs_count = booking.chairs || booking.chairs_count || 0;
        const tables_price = booking.tables_price || (tables_count * 800);
        const chairs_price = booking.chairs_price || (chairs_count * 500);
        const total_price = amount || booking.amount || (tables_price + chairs_price);

        const vars = {
            customer_name: name || '—',
            booking_id: bookingId || '—',
            booking_date: booking.date || booking.booking_date || '—',
            tables_count,
            chairs_count,
            tables_price: (typeof tables_price === 'number') ? (tables_price / 100).toFixed(2).replace('.', ',') : tables_price,
            chairs_price: (typeof chairs_price === 'number') ? (chairs_price / 100).toFixed(2).replace('.', ',') : chairs_price,
            total_price: (typeof total_price === 'number') ? (total_price / 100).toFixed(2).replace('.', ',') : total,
            booking_timestamp: new Date().toLocaleString('it-IT'),
        };

        // Leggi template WhatsApp cliente
        const template = await fs.readFile(path.join(__dirname, 'template_whatsapp_customer.txt'), 'utf8');
        
        // Sostituisci variabili
        let message = template.replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (_, key) => {
            return typeof vars[key] !== 'undefined' && vars[key] !== null ? String(vars[key]) : '';
        });

        // Invia WhatsApp al cliente
        const fromTw = process.env.TWILIO_FROM;

        if (fromTw && to && to.includes('whatsapp:')) {
            await twilioClient.messages.create({
                body: message,
                from: fromTw,
                to: to,
            });
            console.log('[WHATSAPP] Conferma cliente inviata a', to);
            return true;
        }
        return false;
    } catch (err) {
        console.error('[WHATSAPP] sendWhatsAppCustomerConfirmation error:', err);
        return false;
    }
}
```

### Passo 3: Integrare WhatsApp nel Processo di Prenotazione

Modificheremo la funzione `sendOwnerNotification` per includere WhatsApp:

```javascript
async sendOwnerNotification({ booking = {}, amount = 0, notifyCustomer = true }) {
    try {
        await twilioInitPromise;
        console.log('[MAILER] sendOwnerNotification start');
        
        // ... codice esistente per email ...

        // Invia WhatsApp al proprietario
        try {
            if (twilioClient) {
                await this.sendWhatsAppOwnerNotification({ booking, amount });
            }
        } catch (whatsappErr) {
            console.warn('[WHATSAPP] WhatsApp owner notification failed:', whatsappErr);
        }

        // Invia WhatsApp al cliente
        if (notifyCustomer) {
            try {
                if (booking.phone && booking.phone.includes('@')) {
                    // Invia email al cliente (codice esistente)
                    await this.sendCustomerConfirmation({ to: booking.phone, booking, amount });
                } else if (booking.phone) {
                    // Invia WhatsApp al cliente
                    const customerWhatsApp = `whatsapp:+${booking.phone.replace(/\D/g, '')}`;
                    await this.sendWhatsAppCustomerConfirmation({ to: customerWhatsApp, booking, amount });
                }
            } catch (e) {
                console.warn('[MAILER] Customer notification failed:', e);
            }
        }

        return true;
    } catch (err) {
        console.error('[MAILER] sendOwnerNotification error:', err);
        return false;
    }
}
```

## Aggiornamento Automatico del File di Gestione Prenotazioni

### Opzione 1: Aggiornamento in Tempo Reale

Il file `html/gestione-prenotazioni.html` può essere configurato per aggiornarsi automaticamente:

```javascript
// Aggiungi a booking-admin.js
let autoRefreshInterval;

function startAutoRefresh() {
    if (autoRefreshInterval) clearInterval(autoRefreshInterval);
    autoRefreshInterval = setInterval(() => {
        loadBookings();
        loadDonations();
    }, 30000); // Aggiorna ogni 30 secondi
}

function stopAutoRefresh() {
    if (autoRefreshInterval) {
        clearInterval(autoRefreshInterval);
        autoRefreshInterval = null;
    }
}

// Avvia aggiornamento automatico quando la pagina è visibile
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
        startAutoRefresh();
    } else {
        stopAutoRefresh();
    }
});
```

### Opzione 2: Aggiornamento Manuale con Notifica

Aggiungi un pulsante per forzare l'aggiornamento:

```javascript
// Aggiungi a booking-admin.js
document.getElementById('refreshBookingList').addEventListener('click', async () => {
    await loadBookings();
    await loadDonations();
    showNotification('Lista aggiornata');
});
```

## Configurazione Consigliata

### Per il Backend (.env):
```env
# Twilio per WhatsApp
TWILIO_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=yyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyy
TWILIO_FROM=whatsapp:+14155238886
OWNER_PHONE=whatsapp:+393334993469

# Configurazione base
STRIPE_SECRET_KEY=sk_test_xxx
MONGO_URI=mongodb://localhost:27017/lido
PORT=3000
```

### Vantaggi:
✅ **Template completi**: Tutte le informazioni importanti vengono inviate  
✅ **WhatsApp immediato**: Notifiche istantanee al proprietario e cliente  
✅ **Aggiornamento automatico**: La dashboard si aggiorna in tempo reale  
✅ **Nessun SMTP**: Sistema completamente indipendente dalle email  
✅ **Costi ridotti**: WhatsApp è più economico delle email transazionali  

## Prossimi Passi:

1. **Configurare Twilio**: Creare account Twilio e abilitare WhatsApp
2. **Creare template**: Salvare i file template WhatsApp
3. **Aggiornare mailer**: Modificare il file mailer.js
4. **Testare**: Verificare che tutto funzioni correttamente
5. **Deploy**: Deploy su Vercel per rendere attive le modifiche

Questo sistema fornirà una soluzione completa senza SMTP, con notifiche immediate via WhatsApp e aggiornamento automatico della dashboard di gestione.