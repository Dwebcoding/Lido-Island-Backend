// Main server (ESM)
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import Stripe from 'stripe';
import Booking from './models/booking.js';
import mailer from './services/mailer.js';
import stripeRouter from './stripe.js';
import path from 'path';
import { fileURLToPath } from 'url';
const app = express();
// Abilita fallback insicuro per webhook in ambiente di sviluppo per facilitare
// i test locali (stripe CLI / ngrok). NON abilitare in produzione.
if (!process.env.ALLOW_INSECURE_WEBHOOK) {
	process.env.ALLOW_INSECURE_WEBHOOK = process.env.NODE_ENV === 'production' ? 'false' : 'true';
}
// Applica un middleware RAW specifico SOLO per il webhook Stripe prima dei
// parser globali. Questo assicura che il corpo "raw" non venga alterato
// dal parser JSON quando Stripe verifica la firma.
app.post('/api/payment/webhook', express.raw({ type: 'application/json' }), (req, res, next) => {
	// Salva il buffer grezzo in `req.rawBody` in modo che il router lo usi.
	req.rawBody = req.body;
	next();
});

// Ora applico i middleware per tutte le altre route
const corsOptions = {
	origin: function (origin, callback) {
		// Lista domini consentiti
		const allowedOrigins = [
			'https://www.isolalido.it',
			'https://isolalido.it',
			'http://localhost:5500',
			'http://127.0.0.1:5500',
			'http://localhost:3000',
			'http://127.0.0.1:3000'
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
	methods: ['GET', 'POST', 'PATCH', 'OPTIONS', 'PUT', 'DELETE'],
	allowedHeaders: [
		'Content-Type', 
		'Authorization', 
		'x-admin-key',
		'X-Requested-With',
		'Accept',
		'Origin'
	],
	credentials: true, // Consente l'invio di cookie e credenziali
	optionsSuccessStatus: 200, // Per compatibilità con vecchi browser
	preflightContinue: false,
	maxAge: 86400 // Cache preflight per 24 ore
};

// Middleware CORS specifico per tutti gli endpoint
app.use((req, res, next) => {
	// Applica CORS a tutte le rotte tranne webhook
	if (!req.originalUrl.startsWith('/api/payment/webhook')) {
		cors(corsOptions)(req, res, next);
	} else {
		next();
	}
});

// Le richieste OPTIONS sono gestite automaticamente dal middleware CORS
// Non è necessario un gestore esplicito per tutte le rotte

// Parser JSON globale, ma salta il webhook Stripe per evitare qualunque
// alterazione del corpo che invaliderebbe la firma.
app.use((req, res, next) => {
	if (req.originalUrl.startsWith('/api/payment/webhook')) return next();
	return express.json({
		verify: (_req, _res, buf) => { _req.rawBody = buf; }
	})(req, res, next);
});

// Monta le route di pagamento (webhook e crea sessione)
app.use('/api/payment', stripeRouter);

// Serve file statici dalla root del progetto (success.html, index.html, css, js, etc.)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use(express.static(path.join(__dirname, '..')));

// Serve HTML files from the html/ directory
app.use('/html', express.static(path.join(__dirname, '..', 'html')));
// Connessione a MongoDB
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/lido';
mongoose.connect(MONGO_URI)
	.then(() => console.log('[Isola Lido Backend] Connesso a MongoDB'))
	.catch(err => console.error('[Isola Lido Backend] Errore connessione MongoDB:', err));
// ...server setup...
import bookingRoutes from './routes/booking.js';
bookingRoutes(app);

// Endpoint ping per test connettività
app.get('/api/booking/ping', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Endpoint health check generale
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// ...existing code...
// (RIMOSSO) Tutte le altre route payment
// app.use('/api/payment', stripeRouter);
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
	console.log(`[Isola Lido Backend] Server avviato sulla porta ${PORT}`);
});
export default app;
