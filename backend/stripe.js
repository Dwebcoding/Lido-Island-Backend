import express from 'express';
import Stripe from 'stripe';
import Booking from './models/booking.js';
import mailer from './services/mailer.js';

const router = express.Router();

// Preferisci le chiavi dal process.env in produzione
const stripeSecret = process.env.STRIPE_SECRET_KEY || 'sk_test_xxx';
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET; // obbligatorio in produzione
const isPlaceholderKey = !stripeSecret || stripeSecret.includes('sk_test_xxx');

// Se la chiave è mancante o placeholder, blocca il checkout con un messaggio chiaro
let stripe;
if (isPlaceholderKey) {
  console.warn('[Stripe] STRIPE_SECRET_KEY mancante o placeholder. Checkout disabilitato finché non configuri la chiave.');
} else {
  stripe = new Stripe(stripeSecret, { apiVersion: null });
  console.log('[Stripe] secret prefix', stripeSecret?.slice(0, 4));
}

// Webhook handler
router.post('/webhook', async (req, res) => {
  const whSecret = (endpointSecret || '').trim();
  console.log('[Stripe Webhook] start handler, endpointSecret length:', endpointSecret ? endpointSecret.length : 'none', 'trimmed length:', whSecret.length);
  const sig = req.headers['stripe-signature'];
  let event;
  let payload;
  try {
    payload = req.rawBody && (typeof req.rawBody === 'string' || Buffer.isBuffer(req.rawBody))
      ? req.rawBody
      : (Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body || {})));

    console.log('[Stripe Webhook] stripe-signature header:', sig);
    console.log('[Stripe Webhook] raw body length:', payload && payload.length ? payload.length : 'unknown');
    console.log('[Stripe Webhook] env endpointSecret present:', !!endpointSecret);

    if (whSecret) {
      // Verifica la firma del webhook
      event = stripe.webhooks.constructEvent(payload, sig, whSecret);
      console.log('[Stripe Webhook] constructEvent ok, type:', event?.type);
    } else if (process.env.ALLOW_INSECURE_WEBHOOK === 'true') {
      // Solo per sviluppo locale: fallback che tenta di parsare il body
      try {
        event = typeof payload === 'string' ? JSON.parse(payload) : JSON.parse(payload.toString('utf8'));
        console.warn('[Stripe Webhook] Using INSECURE fallback parsing for webhook (dev only).');
      } catch (parseErr) {
        console.error('[Stripe Webhook] fallback parse failed:', parseErr.message);
        return res.status(400).send('Webhook parse error');
      }
    } else {
      console.error('[Stripe Webhook] Missing STRIPE_WEBHOOK_SECRET and insecure fallback disabled.');
      return res.status(400).send('Webhook signature verification failed');
    }
  } catch (err) {
    console.error('[Stripe Webhook] signature verification failed:', err.message);
    return res.status(400).send('Webhook signature verification failed');
  }

  try {
    if (event && event.type === 'checkout.session.completed') {
      console.log('[Stripe Webhook] handling event type:', event.type);
      console.log('[Stripe Webhook] mail env snapshot:', {
        SMTP_HOST: process.env.SMTP_HOST,
        SMTP_PORT: process.env.SMTP_PORT,
        SMTP_USER: process.env.SMTP_USER,
        FROM_EMAIL: process.env.FROM_EMAIL,
        OWNER_EMAIL: process.env.OWNER_EMAIL
      });
      const session = event.data.object;
      let bookingData = {};
      try {
        const rawBooking = session && session.metadata && session.metadata.booking;
        if (typeof rawBooking === 'string') {
          const trimmed = rawBooking.trim();
          if (trimmed && (trimmed.startsWith('{') || trimmed.startsWith('['))) {
            bookingData = JSON.parse(trimmed);
          } else {
            console.warn('[Stripe Webhook] session.metadata.booking is not JSON, skipping parse.');
          }
        }
      } catch (parseErr) {
        console.warn('[Stripe Webhook] Could not parse session.metadata.booking:', parseErr.message);
        bookingData = {};
      }

      let bookingRecord = null;
      try {
        bookingRecord = await Booking.create({
          ...bookingData,
          email: session.customer_email,
          paymentId: session.id,
          amount: session.amount_total,
          status: 'active'
        });
      } catch (dbErr) {
        console.warn('[Stripe Webhook] Booking save failed (continuo con le email):', dbErr.message);
      }

      try {
        await mailer.sendOwnerNotification({ booking: { ...bookingData, email: session.customer_email }, amount: session.amount_total });
      } catch (mailErr) {
        console.error('[Stripe Webhook] sendOwnerNotification failed:', mailErr);
      }
      console.log('Prenotazione salvata e notificato il proprietario:', session.customer_email);
    }
  } catch (err) {
    console.error('[Stripe Webhook] errore interno gestionale:', err);
  }

  res.json({ received: true });
});

// Crea una sessione di pagamento
router.post('/create-checkout-session', async (req, res) => {
  const { amount, email, description, metadata } = req.body || {};
  try {
    if (isPlaceholderKey || !stripe) {
      return res.status(503).json({ error: 'Pagamento disabilitato: configura STRIPE_SECRET_KEY nel file .env del backend.' });
    }
    const cents = Number.isFinite(Number(amount)) ? Math.round(Number(amount)) : null;
    if (!cents || cents <= 0) return res.status(400).json({ error: 'Importo non valido' });

    const successUrl = process.env.SUCCESS_URL || 'https://www.isolalido.it/success.html';
    const cancelUrl = process.env.CANCEL_URL || 'https://www.isolalido.it/index.html';

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'eur',
            product_data: { name: description || 'Prenotazione Lido Island' },
            unit_amount: cents,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      customer_email: email,
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: metadata || {},
    });
    res.json({ url: session.url });
  } catch (err) {
    console.error('[Stripe] create-checkout-session error:', err);
    res.status(500).json({ error: err && err.message ? err.message : 'Errore server' });
  }
});

export default router;
