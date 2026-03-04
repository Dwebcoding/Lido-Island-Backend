// Serverless entrypoint for Vercel (@vercel/node)
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import stripeRouter from '../stripe.js';
import bookingRoutes from '../routes/booking.js';
import path from 'path';
import { fileURLToPath } from 'url';

const app = express();

// Fallback per ambiente di sviluppo (non abilitare in produzione)
if (!process.env.ALLOW_INSECURE_WEBHOOK) {
  process.env.ALLOW_INSECURE_WEBHOOK = process.env.NODE_ENV === 'production' ? 'false' : 'true';
}

// Middleware RAW solo per il webhook Stripe (necessario per verifica firma)
app.post('/api/payment/webhook', express.raw({ type: 'application/json' }), (req, res, next) => {
  req.rawBody = req.body;
  next();
});

// Middleware generali
const corsOptions = {
  origin: ['https://www.isolalido.it', 'https://isolalido.it'],
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  preflightContinue: false
};
app.use(cors(corsOptions));
// Handle preflight explicitly (some Vercel setups require a concrete matcher)
app.options('/api/payment/create-checkout-session', cors(corsOptions));
app.options('/api/payment/webhook', cors(corsOptions));
app.options('*', cors(corsOptions));
// Salta il parser JSON per il webhook per evitare che il body venga alterato
app.use((req, res, next) => {
  if (req.originalUrl.startsWith('/api/payment/webhook')) return next();
  return express.json({
    verify: (_req, _res, buf) => { _req.rawBody = buf; }
  })(req, res, next);
});

// Mount routes
app.use('/api/payment', stripeRouter);
bookingRoutes(app);

// Static (opzionale: serve la cartella backend; il frontend sta altrove)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use(express.static(path.join(__dirname, '..')));

// Connessione a MongoDB (Atlas o altro host raggiungibile da Vercel)
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/lido';
mongoose.connect(MONGO_URI)
  .then(() => console.log('[Isola Lido Backend] Connesso a MongoDB'))
  .catch(err => console.error('[Isola Lido Backend] Errore connessione MongoDB:', err));

// Handler export per Vercel serverless
export default function handler(req, res) {
  return app(req, res);
}
