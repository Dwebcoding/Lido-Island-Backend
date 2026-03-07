// Serverless entrypoint for Vercel (@vercel/node)
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
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

// Middleware CORS
const corsOptions = {
  origin: function (origin, callback) {
    // Lista domini consentiti
    const allowedOrigins = [
      'https://www.isolalido.it',
      'https://isolalido.it',
      'http://localhost:3000',
      'http://127.0.0.1:5500',
      'http://localhost:5500'
    ];
    
    // Consentire richieste senza origine (come mobile apps o curl)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.warn('[CORS] Origine non consentita:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type', 
    'Authorization', 
    'x-admin-key',
    'X-Requested-With',
    'Accept',
    'Origin'
  ],
  credentials: true,
  optionsSuccessStatus: 200,
  preflightContinue: false,
  maxAge: 86400
};

// Applica CORS a tutte le rotte tranne webhook
app.use((req, res, next) => {
  if (!req.originalUrl.startsWith('/api/payment/webhook')) {
    cors(corsOptions)(req, res, next);
  } else {
    next();
  }
});

// Salta il parser JSON per il webhook per evitare che il body venga alterato
app.use((req, res, next) => {
  if (req.originalUrl.startsWith('/api/payment/webhook')) return next();
  return express.json({
    verify: (_req, _res, buf) => { _req.rawBody = buf; }
  })(req, res, next);
});

// Importa e monta le rotte in modo dinamico per evitare problemi di importazione
app.get('/api/booking/tavoli-disponibili', async (req, res) => {
  try {
    const { date } = req.query;
    if (!date) return res.status(400).json({ error: 'Data richiesta' });
    
    // Regole di apertura/chiusura specifiche (anno 2026)
    function isDateOpen(dateStr) {
      if (!dateStr) return false;
      const d = new Date(`${dateStr}T00:00:00`);
      if (Number.isNaN(d.getTime())) return false;
      const year = d.getFullYear();
      const month = d.getMonth() + 1;
      const day = d.getDate();
      const weekday = d.getDay();

      const startYear = 2026;
      const endYear = 2036;

      const explicitOpenPatterns = ['04-05', '04-06', '04-25', '05-01'];
      const explicitBlockedPatterns = ['04-07'];

      const explicitOpen = new Set();
      const explicitBlocked = new Set();
      for (let y = startYear; y <= endYear; y++) {
        explicitOpenPatterns.forEach((p) => explicitOpen.add(`${y}-${p}`));
        explicitBlockedPatterns.forEach((p) => explicitBlocked.add(`${y}-${p}`));
      }

      if (explicitBlocked.has(dateStr)) return false;
      if (explicitOpen.has(dateStr)) return true;

      if (year >= startYear && year <= endYear) {
        if ((month === 4 || month === 5) && weekday === 0) return true;
        if (month >= 6 && month <= 8) return true;
        if (month === 9 && day >= 1 && day <= 13) return true;
      }

      return false;
    }

    if (!isDateOpen(date)) return res.json({ tavoliDisponibili: 0, open: false });

    // Connessione a MongoDB (Atlas o altro host raggiungibile da Vercel)
    const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/lido';
    if (!mongoose.connection.readyState) {
      await mongoose.connect(MONGO_URI);
    }

    const TAVOLI_TOTALI = 110;
    
    const prenotazioni = await mongoose.connection.db.collection('bookings').aggregate([
      { $match: { status: 'active', date } },
      { $group: { _id: null, totale: { $sum: '$tables' } } }
    ]).toArray();
    
    const tavoliPrenotati = prenotazioni[0]?.totale || 0;
    const tavoliDisponibili = TAVOLI_TOTALI - tavoliPrenotati;
    return res.json({ tavoliDisponibili });
  } catch (error) {
    console.warn('[Booking] Fallback tavoli-disponibili, uso valori statici:', error?.message);
    return res.json({ tavoliDisponibili: 110, open: true, fallback: true });
  }
});

app.get('/api/booking/sdraio-disponibili', async (req, res) => {
  try {
    const { date } = req.query;
    if (!date) return res.status(400).json({ error: 'Data richiesta' });
    
    // Regole di apertura/chiusura specifiche (anno 2026)
    function isDateOpen(dateStr) {
      if (!dateStr) return false;
      const d = new Date(`${dateStr}T00:00:00`);
      if (Number.isNaN(d.getTime())) return false;
      const year = d.getFullYear();
      const month = d.getMonth() + 1;
      const day = d.getDate();
      const weekday = d.getDay();

      const startYear = 2026;
      const endYear = 2036;

      const explicitOpenPatterns = ['04-05', '04-06', '04-25', '05-01'];
      const explicitBlockedPatterns = ['04-07'];

      const explicitOpen = new Set();
      const explicitBlocked = new Set();
      for (let y = startYear; y <= endYear; y++) {
        explicitOpenPatterns.forEach((p) => explicitOpen.add(`${y}-${p}`));
        explicitBlockedPatterns.forEach((p) => explicitBlocked.add(`${y}-${p}`));
      }

      if (explicitBlocked.has(dateStr)) return false;
      if (explicitOpen.has(dateStr)) return true;

      if (year >= startYear && year <= endYear) {
        if ((month === 4 || month === 5) && weekday === 0) return true;
        if (month >= 6 && month <= 8) return true;
        if (month === 9 && day >= 1 && day <= 13) return true;
      }

      return false;
    }

    if (!isDateOpen(date)) return res.json({ sdraioDisponibili: 0, open: false });

    // Connessione a MongoDB (Atlas o altro host raggiungibile da Vercel)
    const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/lido';
    if (!mongoose.connection.readyState) {
      await mongoose.connect(MONGO_URI);
    }

    const SDRAIO_TOTALI = 65;
    
    const prenotazioni = await mongoose.connection.db.collection('bookings').aggregate([
      { $match: { status: 'active', date } },
      { $group: { _id: null, totale: { $sum: '$chairs' } } }
    ]).toArray();
    
    const sdraioPrenotati = prenotazioni[0]?.totale || 0;
    const sdraioDisponibili = SDRAIO_TOTALI - sdraioPrenotati;
    return res.json({ sdraioDisponibili });
  } catch (error) {
    console.warn('[Booking] Fallback sdraio-disponibili, uso valori statici:', error?.message);
    return res.json({ sdraioDisponibili: 65, open: true, fallback: true });
  }
});

app.get('/api/booking/ombrelloni-disponibili', async (req, res) => {
  try {
    const { date } = req.query;
    if (!date) return res.status(400).json({ error: 'Data richiesta' });
    
    // Regole di apertura/chiusura specifiche (anno 2026)
    function isDateOpen(dateStr) {
      if (!dateStr) return false;
      const d = new Date(`${dateStr}T00:00:00`);
      if (Number.isNaN(d.getTime())) return false;
      const year = d.getFullYear();
      const month = d.getMonth() + 1;
      const day = d.getDate();
      const weekday = d.getDay();

      const startYear = 2026;
      const endYear = 2036;

      const explicitOpenPatterns = ['04-05', '04-06', '04-25', '05-01'];
      const explicitBlockedPatterns = ['04-07'];

      const explicitOpen = new Set();
      const explicitBlocked = new Set();
      for (let y = startYear; y <= endYear; y++) {
        explicitOpenPatterns.forEach((p) => explicitOpen.add(`${y}-${p}`));
        explicitBlockedPatterns.forEach((p) => explicitBlocked.add(`${y}-${p}`));
      }

      if (explicitBlocked.has(dateStr)) return false;
      if (explicitOpen.has(dateStr)) return true;

      if (year >= startYear && year <= endYear) {
        if ((month === 4 || month === 5) && weekday === 0) return true;
        if (month >= 6 && month <= 8) return true;
        if (month === 9 && day >= 1 && day <= 13) return true;
      }

      return false;
    }

    if (!isDateOpen(date)) return res.json({ ombrelloniDisponibili: 0, open: false });

    // Connessione a MongoDB (Atlas o altro host raggiungibile da Vercel)
    const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/lido';
    if (!mongoose.connection.readyState) {
      await mongoose.connect(MONGO_URI);
    }

    const OMBRELLONI_TOTALI = 65;
    
    const prenotazioni = await mongoose.connection.db.collection('bookings').aggregate([
      { $match: { status: 'active', date } },
      { $group: { _id: null, totale: { $sum: '$umbrellas' } } }
    ]).toArray();
    
    const ombrelloniPrenotati = prenotazioni[0]?.totale || 0;
    const ombrelloniDisponibili = OMBRELLONI_TOTALI - ombrelloniPrenotati;
    return res.json({ ombrelloniDisponibili });
  } catch (error) {
    console.warn('[Booking] Fallback ombrelloni-disponibili, uso valori statici:', error?.message);
    return res.json({ ombrelloniDisponibili: 65, open: true, fallback: true });
  }
});

app.get('/api/booking/tavoli-occupati', async (req, res) => {
  try {
    const { date } = req.query;
    if (!date) return res.status(400).json({ error: 'Data richiesta' });
    
    // Regole di apertura/chiusura specifiche (anno 2026)
    function isDateOpen(dateStr) {
      if (!dateStr) return false;
      const d = new Date(`${dateStr}T00:00:00`);
      if (Number.isNaN(d.getTime())) return false;
      const year = d.getFullYear();
      const month = d.getMonth() + 1;
      const day = d.getDate();
      const weekday = d.getDay();

      const startYear = 2026;
      const endYear = 2036;

      const explicitOpenPatterns = ['04-05', '04-06', '04-25', '05-01'];
      const explicitBlockedPatterns = ['04-07'];

      const explicitOpen = new Set();
      const explicitBlocked = new Set();
      for (let y = startYear; y <= endYear; y++) {
        explicitOpenPatterns.forEach((p) => explicitOpen.add(`${y}-${p}`));
        explicitBlockedPatterns.forEach((p) => explicitBlocked.add(`${y}-${p}`));
      }

      if (explicitBlocked.has(dateStr)) return false;
      if (explicitOpen.has(dateStr)) return true;

      if (year >= startYear && year <= endYear) {
        if ((month === 4 || month === 5) && weekday === 0) return true;
        if (month >= 6 && month <= 8) return true;
        if (month === 9 && day >= 1 && day <= 13) return true;
      }

      return false;
    }

    if (!isDateOpen(date)) return res.json({ tavoliOccupati: [], open: false });

    // Connessione a MongoDB (Atlas o altro host raggiungibile da Vercel)
    const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/lido';
    if (!mongoose.connection.readyState) {
      await mongoose.connect(MONGO_URI);
    }

    const TAVOLI_TOTALI = 110;
    
    const bookings = await mongoose.connection.db.collection('bookings').find(
      { status: 'active', date, tableNumbers: { $exists: true, $ne: [] } },
      { tableNumbers: 1, _id: 0 }
    ).toArray();

    const used = new Set();
    for (const booking of bookings) {
      for (const n of booking.tableNumbers || []) {
        const num = Number(n);
        if (Number.isInteger(num) && num >= 1 && num <= TAVOLI_TOTALI) used.add(num);
      }
    }

    return res.json({ tavoliOccupati: Array.from(used).sort((a, b) => a - b), open: true });
  } catch (error) {
    console.warn('[Booking] Fallback tavoli-occupati, nessun tavolo marcato occupato:', error?.message);
    return res.json({ tavoliOccupati: [], open: true, fallback: true });
  }
});

// Mount routes
app.get('/api/ping', (req, res) => {
  res.json({ ok: true, service: 'backend', timestamp: new Date().toISOString() });
});

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
  // Set CORS headers manually for Vercel
  const origin = req.headers.origin;
  const allowedOrigins = ['https://www.isolalido.it', 'https://isolalido.it', 'http://localhost:3000', 'http://127.0.0.1:5500'];
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,x-admin-key');
  
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  
  return app(req, res);
}