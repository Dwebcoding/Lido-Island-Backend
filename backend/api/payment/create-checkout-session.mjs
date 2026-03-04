import Stripe from 'stripe';

const ALLOWED_ORIGINS = new Set([
  'https://www.isolalido.it',
  'https://isolalido.it',
]);

function applyCors(req, res) {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

function getBody(req) {
  if (!req.body) return {};
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  return req.body;
}

export default async function handler(req, res) {
  applyCors(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const stripeSecret = (process.env.STRIPE_SECRET_KEY || '').trim();
    const isProduction = process.env.VERCEL_ENV === 'production' || process.env.NODE_ENV === 'production';

    if (!stripeSecret) {
      return res.status(503).json({ error: 'Pagamento disabilitato: STRIPE_SECRET_KEY mancante.' });
    }
    if (isProduction && stripeSecret.startsWith('sk_test_')) {
      return res.status(503).json({ error: 'Pagamento disabilitato: chiave Stripe test in Production.' });
    }

    const stripe = new Stripe(stripeSecret, { apiVersion: null });
    const { amount, email, description, metadata } = getBody(req);
    const cents = Number.isFinite(Number(amount)) ? Math.round(Number(amount)) : null;

    if (!cents || cents <= 0) {
      return res.status(400).json({ error: 'Importo non valido' });
    }

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

    return res.status(200).json({ url: session.url });
  } catch (err) {
    return res.status(500).json({ error: err?.message || 'Errore server' });
  }
}
