// Mailer service (ESM) - migrated from EmailJS to nodemailer
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import nodemailer from 'nodemailer';
import { getWhatsAppService } from './whatsapp.js';

let twilioClient = null;
// Initialize optional Twilio client lazily without top-level await
const twilioInitPromise = (async () => {
  try {
    // eslint-disable-next-line import/no-extraneous-dependencies
    const twilio = await import('twilio').catch(() => null);
    if (twilio && process.env.TWILIO_SID && process.env.TWILIO_AUTH_TOKEN) {
      twilioClient = twilio.default(process.env.TWILIO_SID, process.env.TWILIO_AUTH_TOKEN);
    }
  } catch (e) {
    // ignore
  }
})();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TEMPLATE_PATH = path.join(__dirname, 'template.html');
const TEMPLATE_CUSTOMER_PATH = path.join(__dirname, 'template_customer.html');

const SMTP_HOST = process.env.SMTP_HOST || null;
const SMTP_PORT = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 587;
const SMTP_USER = process.env.SMTP_USER || null;
const SMTP_PASS = process.env.SMTP_PASS || null;
const FROM_EMAIL = process.env.FROM_EMAIL || 'postamaster@isolalido.it';
const OWNER_EMAIL = process.env.OWNER_EMAIL || 'info@isolalido.it';
const SMTP_PLACEHOLDER = (SMTP_PASS || '').includes('PUT_YOUR_OUTLOOK_APP_PASSWORD_HERE');

function formatCentsToEuro(cents) {
  try {
    const num = Number(cents) / 100;
    return num.toFixed(2).replace('.', ',') + ' €';
  } catch (e) {
    return cents + ' €';
  }
}

async function renderTemplate(vars = {}, templatePath = TEMPLATE_PATH) {
  try {
    const raw = await fs.readFile(templatePath, 'utf8');
    return raw.replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (_, key) => {
      return typeof vars[key] !== 'undefined' && vars[key] !== null ? String(vars[key]) : '';
    });
  } catch (err) {
    console.error('[MAILER] renderTemplate error:', err);
    return '';
  }
}

function makeTransporter() {
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS || SMTP_PLACEHOLDER) {
    console.warn('[MAILER] SMTP credentials not fully configured. Emails will not be sent. Set SMTP_HOST/SMTP_USER/SMTP_PASS with a real password/app password.');
    return null;
  }
  console.log('[MAILER] Creating transporter with host', SMTP_HOST, 'port', SMTP_PORT, 'user', SMTP_USER);
  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
    tls: { rejectUnauthorized: false } // evita blocchi su alcune piattaforme serverless
  });
}

const transporter = makeTransporter();

export default {
  // Invia una mail al proprietario dopo una prenotazione
  async sendOwnerNotification({ booking = {}, amount = 0, notifyCustomer = true }) {
    try {
      await twilioInitPromise;
      console.log('[MAILER] sendOwnerNotification start');
      const tables_count = booking.tables || booking.tables_count || 0;
      const chairs_count = booking.chairs || booking.chairs_count || 0;
      const tables_price = booking.tables_price || (tables_count * 800); // stored in cents
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

      const html = await renderTemplate(vars);

      if (!transporter) {
        console.log('[MAILER] Skipping sendOwnerNotification (transporter not configured).');
        return true;
      }

      const info = await transporter.sendMail({
        from: FROM_EMAIL,
        to: OWNER_EMAIL,
        subject: `Nuova prenotazione da ${vars.customer_name}`,
        html,
      });
      console.log('[MAILER] Owner notification sent:', info.messageId || info);
      
      // Invia WhatsApp al proprietario
      try {
        const whatsapp = getWhatsAppService();
        const whatsappResult = await whatsapp.sendOwnerNotification(booking, amount);
        console.log('[WHATSAPP] Notifica proprietario:', whatsappResult ? 'OK' : 'KO');
      } catch (whatsappErr) {
        console.warn('[WHATSAPP] WhatsApp owner notification failed:', whatsappErr);
      }

      // Optionally send a confirmation to the customer
      if (notifyCustomer) {
        try {
          if (vars.customer_email && vars.customer_email.includes('@')) {
            await this.sendCustomerConfirmation({ to: vars.customer_email, booking, amount });
          }
        } catch (e) {
          console.warn('[MAILER] sendCustomerConfirmation failed:', e);
        }
        
        // Invia WhatsApp al cliente
        if (booking.phone) {
          try {
            const whatsapp = getWhatsAppService();
            const customerPhone = booking.phone.replace(/\D/g, '');
            const whatsappResult = await whatsapp.sendCustomerConfirmation(customerPhone, booking, amount);
            console.log('[WHATSAPP] Conferma cliente:', whatsappResult ? 'OK' : 'KO');
          } catch (e) {
            console.warn('[MAILER] Customer WhatsApp notification failed:', e);
          }
        }
      }

      // Optionally send SMS if Twilio is configured and phone present
      try {
        if (twilioClient && (booking.phone || booking.customer_phone)) {
          const toPhone = booking.phone || booking.customer_phone;
          const fromTw = process.env.TWILIO_FROM;
          if (fromTw) {
            await twilioClient.messages.create({
              body: `Grazie ${vars.customer_name}, la tua prenotazione (${vars.booking_id}) è confermata. Totale: ${vars.total_price}`,
              from: fromTw,
              to: toPhone,
            });
            console.log('[MAILER] SMS inviato a', toPhone);
          }
        }
      } catch (smsErr) {
        console.warn('[MAILER] SMS send failed:', smsErr);
      }

      return true;
    } catch (err) {
      console.error('[MAILER] sendOwnerNotification error:', err);
      return false;
    }
  },

  // Invia conferma al cliente (semplice)
  async sendCustomerConfirmation({ to, booking = {}, amount = 0 }) {
    try {
      await twilioInitPromise;
      console.log('[MAILER] sendCustomerConfirmation start');
      const name = booking.name || booking.customer_name || '';
      const bookingId = booking._id || booking.id || booking.booking_id || '';
      const total = formatCentsToEuro(amount || booking.amount || 0);
      const tables_count = booking.tables || booking.tables_count || 0;
      const chairs_count = booking.chairs || booking.chairs_count || 0;
      const tables_price = booking.tables_price || (tables_count * 800); // cents
      const chairs_price = booking.chairs_price || (chairs_count * 500);
      const total_price = amount || booking.amount || (tables_price + chairs_price);

      const vars = {
        customer_name: name || '—',
        customer_email: booking.email || booking.customer_email || '—',
        customer_phone: booking.phone || booking.customer_phone || '—',
        booking_id: bookingId || '—',
        booking_date: booking.date || booking.booking_date || '—',
        booking_notes: booking.notes || booking.booking_notes || '—',
        tables_count,
        chairs_count,
        tables_price: (typeof tables_price === 'number') ? (tables_price / 100).toFixed(2).replace('.', ',') : tables_price,
        chairs_price: (typeof chairs_price === 'number') ? (chairs_price / 100).toFixed(2).replace('.', ',') : chairs_price,
        total_price: (typeof total_price === 'number') ? (total_price / 100).toFixed(2).replace('.', ',') : total,
        booking_timestamp: new Date().toLocaleString('it-IT'),
      };

      // Usa il template dedicato al cliente
      let html = await renderTemplate(vars, TEMPLATE_CUSTOMER_PATH).catch(() => '');

      if (!html || html.trim() === '') {
        html = `
          <div style="font-family:Arial,Helvetica,sans-serif;line-height:1.4;color:#1a3a4a">
            <h2>Conferma Prenotazione - Isola Lido</h2>
            <p>Ciao ${name},</p>
            <p>Grazie per la tua prenotazione. Il tuo numero prenotazione è <strong>${bookingId}</strong>.</p>
            <p><strong>Importo pagato:</strong> ${total}</p>
            <p>Riceverai una notifica dal gestore se ci fossero aggiornamenti.</p>
            <p>Buona giornata,<br/>Isola Lido</p>
          </div>
        `;
      }

      if (!transporter) {
        console.log('[MAILER] Skipping sendCustomerConfirmation (transporter not configured).');
        return true;
      }

      const info = await transporter.sendMail({
        from: FROM_EMAIL,
        to,
        subject: 'Conferma prenotazione - Isola Lido',
        html: html,
      });
      console.log('[MAILER] Customer confirmation sent:', info.messageId || info);
      return true;
    } catch (err) {
      console.error('[MAILER] sendCustomerConfirmation error:', err);
      return false;
    }
  }
};
