import { makeWASocket, proto, useMultiFileAuthState } from '@whiskeysockets/baileys';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configurazione store per la sessione WhatsApp
const store = null;

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