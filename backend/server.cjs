// Main server (CommonJS)
const express = require('express');
const app = express();
// ...server setup...
const stripeRouter = require('./stripe');
app.use((req, res, next) => {
	// Stripe webhook richiede raw body; per tutte le altre route parsifichiamo
	// il JSON ma salviamo anche il buffer grezzo in `req.rawBody` per sicurezza.
	if (req.originalUrl === '/api/payment/webhook') {
		express.raw({ type: 'application/json' })(req, res, next);
	} else {
		express.json({ verify: (req, res, buf) => { req.rawBody = buf; } })(req, res, next);
	}
});
app.use('/api/payment', stripeRouter);
module.exports = app;