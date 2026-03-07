# Integrazione Baileys per WhatsApp Gratuita

## Configurazione Baileys WhatsApp

### Perché Baileys?
✅ **Completamente gratuito** - Nessun costo mensile  
✅ **API diretta WhatsApp** - Comunicazione diretta con WhatsApp Web  
✅ **Nessun limite di messaggi** - Messaggi illimitati  
✅ **Template completi** - Supporto per messaggi formattati  
✅ **Facile integrazione** - Libreria JavaScript/Node.js  

### Installazione Baileys

#### Passo 1: Installare la dipendenza
```bash
cd backend
npm install @whiskeysockets/baileys
```

#### Passo 2: Creare il servizio WhatsApp

Crea `backend/services/whatsapp.js`:
```javascript
import { makeWASocket, makeInMemoryStore, proto, useMultiFileAuthState } from '@whiskeysockets/baileys';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configurazione store per la sessione WhatsApp
const store = makeInMemoryStore({ 
    logger: { level: 'silent' }
});

export class WhatsAppService {
    constructor() {
        this.sock = null;
        this.isConnected = false;
        this.qrCallback = null;
        this.authPath = path.join(__dirname, '../whatsapp-session');
    }

    // Inizializza la connessione WhatsApp
    async initialize() {
        try {
            // Crea la cartella per la sessione se non esiste
            await fs.mkdir(this.authPath, { recursive: true });

            // Configura lo stato di autenticazione
            const { state, saveCreds } = await useMultiFileAuthState(this.authPath);

            this.sock = makeWASocket({
                auth: state,
                printQRInTerminal: false,
                logger: { level: 'silent' }
            });

            // Gestore QR Code
            this.sock.ev.on('connection.update', (update) => {
                const { connection, qr } = update;
                
                if (qr && this.qrCallback) {
                    this.qrCallback(qr);
                }

                if (connection === 'close') {
                    this.isConnected = false;
                    console.log('[WHATSAPP] Connessione chiusa, tentativo di riconnessione...');
                    setTimeout(() => this.initialize(), 5000);
                } else if (connection === 'open') {
                    this.isConnected = true;
                    console.log('[WHATSAPP] Connessione WhatsApp stabilita');
                    store.bind(this.sock.ev);
                }
            });

            // Salva credenziali
            this.sock.ev.on('creds.update', saveCreds);

            return true;
        } catch (error) {
            console.error('[WHATSAPP] Errore inizializzazione:', error);
            return false;
        }
    }

    // Imposta callback per QR Code
    setQRCodeCallback(callback) {
        this.qrCallback = callback;
    }

    // Invia messaggio WhatsApp
    async sendMessage(to, message) {
        if (!this.isConnected || !this.sock) {
            console.log('[WHATSAPP] Non connesso, messaggio ignorato');
            return false;
        }

        try {
            // Formatta il numero per WhatsApp
            const formattedNumber = this.formatNumber(to);
            
            await this.sock.sendMessage(formattedNumber, {
                text: message
            });

            console.log('[WHATSAPP] Messaggio inviato a', formattedNumber);
            return true;
        } catch (error) {
            console.error('[WHATSAPP] Errore invio messaggio:', error);
            return false;
        }
    }

    // Invia messaggio con template proprietario
    async sendOwnerNotification(booking, amount) {
        if (!this.isConnected || !this.sock) {
            console.log('[WHATSAPP] Non connesso, notifica proprietario ignorata');
            return false;
        }

        try {
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

            // Template proprietario per WhatsApp
            const message = `
🎉 *NUOVA PRENOTAZIONE RICEVUTA!*

*👤 DATI CLIENTE:*
• Nome: ${vars.customer_name}
• Email: ${vars.customer_email}
• Telefono: ${vars.customer_phone}
• ID Prenotazione: ${vars.booking_id}

*📅 DATA PRENOTAZIONE:* ${vars.booking_date}

*📋 ARTICOLI PRENOTATI:*
• Tavoli: ${vars.tables_count} x €8,00 = €${vars.tables_price}
• Sdraio/Ombrelloni: ${vars.chairs_count} x €5,00 = €${vars.chairs_price}

*🍽️ NUMERI TAVOLI:* ${vars.table_numbers}

*📝 NOTE AGGIUNTIVE:* ${vars.booking_notes}

*💰 TOTALE:* €${vars.total_price}

Prenotazione ricevuta il: ${vars.booking_timestamp}

*Isola Lido - Piscina e Relax per tutta la famiglia*
📍 Via Rivolta, 20062 - Cassano d'Adda (MI)
📞 333-499-3469
📧 info@isolalido.it
            `.trim();

            const ownerPhone = process.env.OWNER_PHONE || '393334993469';
            return await this.sendMessage(ownerPhone, message);
        } catch (error) {
            console.error('[WHATSAPP] Errore notifica proprietario:', error);
            return false;
        }
    }

    // Invia conferma al cliente
    async sendCustomerConfirmation(phone, booking, amount) {
        if (!this.isConnected || !this.sock) {
            console.log('[WHATSAPP] Non connesso, conferma cliente ignorata');
            return false;
        }

        try {
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

            // Template cliente per WhatsApp
            const message = `
*Conferma ricezione prenotazione*

Ciao ${vars.customer_name},

Abbiamo ricevuto la tua prenotazione. Ecco il riepilogo:

• *Numero prenotazione:* ${vars.booking_id}
• *Data:* ${vars.booking_date}
• *Tavoli:* ${vars.tables_count}
• *Sdraio/Ombrelloni:* ${vars.chairs_count}
• *Totale:* €${vars.total_price}

Ricevuta il: ${vars.booking_timestamp}

Grazie per aver scelto Isola Lido!
📞 333-499-3469
📧 info@isolalido.it
            `.trim();

            return await this.sendMessage(phone, message);
        } catch (error) {
            console.error('[WHATSAPP] Errore conferma cliente:', error);
            return false;
        }
    }

    // Formatta numero per WhatsApp
    formatNumber(phone) {
        // Rimuove tutti i caratteri non numerici
        const cleanNumber = phone.replace(/\D/g, '');
        
        // Se inizia con 0, lo rimuove
        let formatted = cleanNumber;
        if (formatted.startsWith('0')) {
            formatted = formatted.substring(1);
        }
        
        // Se non inizia con il prefisso internazionale, lo aggiunge
        if (!formatted.startsWith('39')) {
            formatted = '39' + formatted;
        }
        
        return formatted + '@s.whatsapp.net';
    }

    // Controlla stato connessione
    getStatus() {
        return {
            connected: this.isConnected,
            ready: this.sock !== null
        };
    }
}

// Funzione helper per formattare i centesimi
function formatCentsToEuro(cents) {
    try {
        const num = Number(cents) / 100;
        return num.toFixed(2).replace('.', ',') + ' €';
    } catch (e) {
        return cents + ' €';
    }
}

// Istanza singleton
let whatsappService = null;

export function getWhatsAppService() {
    if (!whatsappService) {
        whatsappService = new WhatsAppService();
    }
    return whatsappService;
}
```

### Configurazione Backend

#### Passo 3: Aggiornare il Mailer

Modifica `backend/services/mailer.js` per integrare Baileys:
```javascript
// Importa il servizio WhatsApp
import { getWhatsAppService } from './whatsapp.js';

// Aggiungi funzioni per WhatsApp
async function sendWhatsAppOwnerNotification({ booking = {}, amount = 0 }) {
    const whatsapp = getWhatsAppService();
    return await whatsapp.sendOwnerNotification(booking, amount);
}

async function sendWhatsAppCustomerConfirmation({ to, booking = {}, amount = 0 }) {
    const whatsapp = getWhatsAppService();
    return await whatsapp.sendCustomerConfirmation(to, booking, amount);
}

// Modifica la funzione sendOwnerNotification per includere WhatsApp
async sendOwnerNotification({ booking = {}, amount = 0, notifyCustomer = true }) {
    try {
        await twilioInitPromise;
        console.log('[MAILER] sendOwnerNotification start');
        
        // ... codice esistente per email ...

        // Invia WhatsApp al proprietario
        try {
            const whatsappResult = await sendWhatsAppOwnerNotification({ booking, amount });
            console.log('[WHATSAPP] Notifica proprietario:', whatsappResult ? 'OK' : 'KO');
        } catch (whatsappErr) {
            console.warn('[WHATSAPP] WhatsApp owner notification failed:', whatsappErr);
        }

        // Invia WhatsApp al cliente
        if (notifyCustomer && booking.phone) {
            try {
                const customerPhone = booking.phone.replace(/\D/g, '');
                const whatsappResult = await sendWhatsAppCustomerConfirmation({ 
                    to: customerPhone, 
                    booking, 
                    amount 
                });
                console.log('[WHATSAPP] Conferma cliente:', whatsappResult ? 'OK' : 'KO');
            } catch (e) {
                console.warn('[MAILER] Customer WhatsApp notification failed:', e);
            }
        }

        return true;
    } catch (err) {
        console.error('[MAILER] sendOwnerNotification error:', err);
        return false;
    }
}
```

#### Passo 4: Configurazione .env

Aggiungi al file `backend/.env`:
```env
# Baileys WhatsApp (Gratuito)
OWNER_PHONE=393334993469

# Configurazione base
STRIPE_SECRET_KEY=sk_test_xxx
MONGO_URI=mongodb://localhost:27017/lido
PORT=3000
```

### Setup e Avvio

#### Passo 5: Avvio del Servizio WhatsApp

Crea `backend/whatsapp-server.js`:
```javascript
import { getWhatsAppService } from './services/whatsapp.js';

async function startWhatsAppService() {
    console.log('[WHATSAPP] Avvio servizio WhatsApp...');
    
    const whatsapp = getWhatsAppService();
    
    // Imposta callback per QR Code (opzionale per debug)
    whatsapp.setQRCodeCallback((qr) => {
        console.log('[WHATSAPP] QR Code generato, scansiona con WhatsApp:');
        console.log(qr);
    });
    
    // Inizializza la connessione
    const success = await whatsapp.initialize();
    
    if (success) {
        console.log('[WHATSAPP] Servizio WhatsApp avviato con successo');
    } else {
        console.error('[WHATSAPP] Errore avvio servizio WhatsApp');
    }
    
    return success;
}

// Avvia il servizio
startWhatsAppService().catch(console.error);

// Esporta per uso in altri moduli
export { startWhatsAppService };
```

#### Passo 6: Integrazione nel Server Principale

Modifica `backend/server.js` per avviare WhatsApp:
```javascript
// Importa il servizio WhatsApp
import './whatsapp-server.js';

// ... resto del codice esistente ...
```

### Configurazione QR Code

#### Passo 7: Pagina Web per QR Code (Opzionale)

Crea `html/whatsapp-qr.html` per visualizzare il QR Code:
```html
<!DOCTYPE html>
<html lang="it">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>WhatsApp QR Code - Isola Lido</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
        .qr-container { text-align: center; margin: 20px 0; }
        #qr-code { width: 300px; height: 300px; border: 1px solid #ccc; padding: 10px; }
        .status { margin: 10px 0; padding: 10px; border-radius: 5px; }
        .connected { background-color: #d4edda; color: #155724; }
        .disconnected { background-color: #f8d7da; color: #721c24; }
    </style>
</head>
<body>
    <h1>WhatsApp QR Code</h1>
    <p>Scansiona il QR Code con WhatsApp per connettere il bot</p>
    
    <div id="status" class="status disconnected">Stato: Disconnesso</div>
    
    <div class="qr-container">
        <div id="qr-code">Caricamento QR Code...</div>
    </div>
    
    <script>
        // WebSocket per ricevere il QR Code in tempo reale
        const ws = new WebSocket('ws://localhost:3001');
        
        ws.onopen = () => {
            document.getElementById('status').textContent = 'Stato: In attesa QR Code';
            document.getElementById('status').className = 'status disconnected';
        };
        
        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.type === 'qr') {
                document.getElementById('qr-code').innerHTML = `<img src="${data.qr}" alt="QR Code">`;
                document.getElementById('status').textContent = 'Stato: Scansiona il QR Code';
            } else if (data.type === 'connected') {
                document.getElementById('status').textContent = 'Stato: Connesso!';
                document.getElementById('status').className = 'status connected';
                document.getElementById('qr-code').innerHTML = '✅ Connessione stabilita!';
            }
        };
        
        ws.onclose = () => {
            document.getElementById('status').textContent = 'Stato: WebSocket chiuso';
            document.getElementById('status').className = 'status disconnected';
        };
    </script>
</body>
</html>
```

### Avvio e Configurazione

#### Passo 8: Istruzioni per l'Uso

1. **Avvia il backend:**
   ```bash
   cd backend
   npm install @whiskeysockets/baileys
   node server.js
   ```

2. **Genera QR Code:**
   - Il server genererà un QR Code automaticamente
   - Scansiona il QR Code con WhatsApp sul tuo telefono
   - Collega il numero WhatsApp che vuoi usare

3. **Verifica connessione:**
   - Controlla i log del server per confermare la connessione
   - Il messaggio "Connessione WhatsApp stabilita" indica successo

4. **Testa una prenotazione:**
   - Fai una prenotazione di test
   - Verifica che i messaggi WhatsApp vengano inviati

### Vantaggi di Baileys:

✅ **Completamente gratuito** - Nessun costo mensile  
✅ **API diretta WhatsApp** - Comunicazione diretta senza intermediari  
✅ **Nessun limite di messaggi** - Messaggi illimitati  
✅ **Template completi** - Supporto per messaggi formattati  
✅ **Facile integrazione** - Libreria JavaScript/Node.js  
✅ **Sessione persistente** - Non richiede QR Code ogni volta  
✅ **Multi-device** - Supporta più dispositivi  

### Note Importanti:

⚠️ **Numero WhatsApp Personale**: Baileys richiede un numero WhatsApp personale  
⚠️ **Connessione Internet**: Richiede connessione stabile per mantenere la sessione  
⚠️ **Sicurezza**: Conserva la cartella `whatsapp-session` in modo sicuro  
⚠️ **Limitazioni**: WhatsApp potrebbe limitare messaggi di massa (ma per prenotazioni è OK)  

### Prossimi Passi:

1. **Installare Baileys**: `npm install @whiskeysockets/baileys`
2. **Creare i file**: `whatsapp.js`, `whatsapp-server.js`
3. **Aggiornare il mailer**: Integrare le funzioni WhatsApp
4. **Configurare .env**: Aggiungere OWNER_PHONE
5. **Testare**: Verificare che tutto funzioni correttamente
6. **Deploy**: Deploy su Vercel per rendere attive le modifiche

Questa soluzione ti darà un sistema di notifiche WhatsApp completamente gratuito con template completi e aggiornamento automatico della dashboard!