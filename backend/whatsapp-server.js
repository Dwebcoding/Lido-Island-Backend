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