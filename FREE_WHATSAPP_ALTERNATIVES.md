# Alternative Gratuite a Twilio per WhatsApp

## Alternative Gratuite e Economiche

### 1. **WhatsApp Business API + Provider Gratuito**

#### **Option 1: 360dialog (Opzione Gratuita)**
- **Costo**: Gratuito per test, poi a consumo
- **Vantaggi**: API ufficiale WhatsApp, facile integrazione
- **Configurazione**: 
  ```env
  WHATSAPP_API_URL=https://waba.360dialog.io/v1
  WHATSAPP_API_KEY=tuo_api_key_gratuito
  WHATSAPP_PHONE_ID=id_telefono_whatsapp
  ```

#### **Option 2: MessageBird (Versione Gratuita)**
- **Costo**: Crediti gratuiti iniziali
- **Vantaggi**: Facile setup, buona documentazione
- **Configurazione**:
  ```env
  MESSAGEBIRD_API_KEY=tuo_api_key
  MESSAGEBIRD_WHATSAPP_NUMBER=numero_whatsapp
  ```

### 2. **Soluzioni Open Source Gratuite**

#### **Option 3: Baileys (WhatsApp Web API)**
- **Costo**: Completamente gratuito
- **Vantaggi**: Nessun costo, API diretta WhatsApp
- **Svantaggi**: Richiede numero WhatsApp personale, meno stabile
- **Installazione**:
  ```bash
  npm install @whiskeysockets/baileys
  ```

#### **Option 4: Venly (Gratuito per piccoli utilizzi)**
- **Costo**: Gratuito fino a 100 messaggi/mese
- **Vantaggi**: Facile integrazione, dashboard
- **Configurazione**:
  ```env
  VENLY_API_KEY=tuo_api_key
  VENLY_WHATSAPP_NUMBER=numero_whatsapp
  ```

### 3. **Soluzioni Alternative (Non WhatsApp)**

#### **Option 5: Telegram Bot (Completamente Gratuito)**
- **Costo**: Completamente gratuito
- **Vantaggi**: API stabile, nessun costo, facile setup
- **Configurazione**:
  ```env
  TELEGRAM_BOT_TOKEN=tuo_token_bot
  TELEGRAM_CHAT_ID=id_chat_propietario
  ```

#### **Option 6: Discord Webhook (Gratuito)**
- **Costo**: Completamente gratuito
- **Vantaggi**: Facile setup, notifiche immediate
- **Configurazione**:
  ```env
  DISCORD_WEBHOOK_URL=url_webhook_discord
  ```

#### **Option 7: Pushover (Versione Gratuita)**
- **Costo**: Gratuito per 7 giorni, poi $5 una tantum
- **Vantaggi**: Notifiche push immediate, app mobile
- **Configurazione**:
  ```env
  PUSHOVER_USER_KEY=tuo_user_key
  PUSHOVER_APP_TOKEN=tuo_app_token
  ```

## Implementazione Consigliata: Telegram Bot

### Perché Telegram?
✅ **Completamente gratuito**  
✅ **API stabile e affidabile**  
✅ **Facile da configurare**  
✅ **App mobile eccellente**  
✅ **Supporto per messaggi formattati**  
✅ **Nessun limite di messaggi**  

### Configurazione Telegram Bot

#### Passo 1: Creare Bot Telegram
1. Apri Telegram e cerca `@BotFather`
2. Invia `/newbot`
3. Segui le istruzioni per creare il bot
4. Riceverai un token API

#### Passo 2: Trovare Chat ID
1. Avvia una chat con il tuo bot
2. Invia un messaggio qualsiasi
3. Vai su: `https://api.telegram.org/bot[TOKEN]/getUpdates`
4. Trova il `chat.id` nei risultati

#### Passo 3: Configurazione Backend

Aggiungi al file `backend/.env`:
```env
# Telegram Bot
TELEGRAM_BOT_TOKEN=123456789:ABCdefGHIjklMNOpqrsTUVwxyz
TELEGRAM_CHAT_ID=123456789
```

#### Passo 4: Creare Servizio Telegram

Crea `backend/services/telegram.js`:
```javascript
import fetch from 'node-fetch';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

export async function sendTelegramMessage(message) {
    if (!BOT_TOKEN || !CHAT_ID) {
        console.log('[TELEGRAM] Configurazione mancante, messaggio ignorato');
        return false;
    }

    try {
        const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                chat_id: CHAT_ID,
                text: message,
                parse_mode: 'HTML',
            }),
        });

        const result = await response.json();
        if (result.ok) {
            console.log('[TELEGRAM] Messaggio inviato con successo');
            return true;
        } else {
            console.error('[TELEGRAM] Errore invio messaggio:', result);
            return false;
        }
    } catch (error) {
        console.error('[TELEGRAM] Errore invio messaggio:', error);
        return false;
    }
}

export async function sendTelegramCustomerMessage(phone, message) {
    if (!BOT_TOKEN) return false;
    
    try {
        const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                chat_id: phone, // Se il cliente ha un bot Telegram
                text: message,
                parse_mode: 'HTML',
            }),
        });

        const result = await response.json();
        return result.ok;
    } catch (error) {
        console.error('[TELEGRAM] Errore invio messaggio cliente:', error);
        return false;
    }
}
```

#### Passo 5: Integrare nel Mailer

Modifica `backend/services/mailer.js` per aggiungere:
```javascript
import { sendTelegramMessage, sendTelegramCustomerMessage } from './telegram.js';

// Aggiungi funzione per inviare notifica Telegram al proprietario
async function sendTelegramOwnerNotification({ booking = {}, amount = 0 }) {
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

    // Template Telegram proprietario
    const message = `
🎉 <b>NUOVA PRENOTAZIONE RICEVUTA!</b>

👤 <b>DATI CLIENTE:</b>
• Nome: ${vars.customer_name}
• Email: ${vars.customer_email}
• Telefono: ${vars.customer_phone}
• ID Prenotazione: <code>${vars.booking_id}</code>

📅 <b>DATA PRENOTAZIONE:</b> ${vars.booking_date}

📋 <b>ARTICOLI PRENOTATI:</b>
• Tavoli: ${vars.tables_count} x €8,00 = €${vars.tables_price}
• Sdraio/Ombrelloni: ${vars.chairs_count} x €5,00 = €${vars.chairs_price}

🍽️ <b>NUMERI TAVOLI:</b> ${vars.table_numbers}

📝 <b>NOTE AGGIUNTIVE:</b> ${vars.booking_notes}

💰 <b>TOTALE:</b> €${vars.total_price}

Prenotazione ricevuta il: ${vars.booking_timestamp}

Isola Lido - Piscina e Relax per tutta la famiglia
📍 Via Rivolta, 20062 - Cassano d'Adda (MI)
📞 333-499-3469
📧 info@isolalido.it
    `.trim();

    return await sendTelegramMessage(message);
}

// Aggiungi funzione per inviare conferma Telegram al cliente
async function sendTelegramCustomerConfirmation({ to, booking = {}, amount = 0 }) {
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

    // Template Telegram cliente
    const message = `
<b>Conferma ricezione prenotazione</b>

Ciao ${vars.customer_name},

Abbiamo ricevuto la tua prenotazione. Ecco il riepilogo:

• <b>Numero prenotazione:</b> <code>${vars.booking_id}</code>
• <b>Data:</b> ${vars.booking_date}
• <b>Tavoli:</b> ${vars.tables_count}
• <b>Sdraio/Ombrelloni:</b> ${vars.chairs_count}
• <b>Totale:</b> €${vars.total_price}

Ricevuta il: ${vars.booking_timestamp}

Grazie per aver scelto Isola Lido!
📞 333-499-3469
📧 info@isolalido.it
    `.trim();

    return await sendTelegramCustomerMessage(to, message);
}
```

## Configurazione Consigliata

### Opzione 1: Telegram Bot (Consigliata)
```env
# Telegram Bot (Gratuito)
TELEGRAM_BOT_TOKEN=123456789:ABCdefGHIjklMNOpqrsTUVwxyz
TELEGRAM_CHAT_ID=123456789

# Configurazione base
STRIPE_SECRET_KEY=sk_test_xxx
MONGO_URI=mongodb://localhost:27017/lido
PORT=3000
```

### Opzione 2: Discord Webhook (Alternativa)
```env
# Discord Webhook (Gratuito)
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/123456789/abcdefghijklmnop

# Configurazione base
STRIPE_SECRET_KEY=sk_test_xxx
MONGO_URI=mongodb://localhost:27017/lido
PORT=3000
```

### Opzione 3: Pushover (Quasi Gratuito)
```env
# Pushover (Quasi Gratuito)
PUSHOVER_USER_KEY=tuo_user_key
PUSHOVER_APP_TOKEN=tuo_app_token

# Configurazione base
STRIPE_SECRET_KEY=sk_test_xxx
MONGO_URI=mongodb://localhost:27017/lido
PORT=3000
```

## Vantaggi delle Alternative Gratuite:

✅ **Costo Zero**: Nessun costo mensile  
✅ **Facile Setup**: Configurazione semplice  
✅ **API Stabili**: Servizi affidabili  
✅ **Nessun Limite**: Messaggi illimitati (tranne Pushover)  
✅ **Mobile App**: App eccellenti per notifiche  
✅ **Formattazione**: Supporto per messaggi formattati  

## Prossimi Passi:

1. **Scegliere l'alternativa**: Telegram (consigliato), Discord, o Pushover
2. **Configurare il servizio**: Creare bot/account
3. **Aggiornare il backend**: Aggiungere il servizio scelto
4. **Testare**: Verificare che tutto funzioni
5. **Deploy**: Deploy su Vercel

La soluzione Telegram è la più consigliata per semplicità, gratuità e affidabilità.