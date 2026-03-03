// Booking route (ESM)
import express from 'express';
import Booking from '../models/booking.js';

const router = express.Router();

// Cancellazione prenotazione gratuita fino a 48h prima
router.patch('/cancella', async (req, res) => {
  try {
    const { email, date } = req.body;
    if (!email || !date) return res.status(400).json({ error: 'Email e data richieste' });
    // Trova la prenotazione attiva
    const booking = await Booking.findOne({ email, date, status: 'active' });
    if (!booking) return res.status(404).json({ error: 'Prenotazione non trovata' });
    // Controlla che manchino almeno 48h
    const now = new Date();
    const bookingDate = new Date(date);
    const diffMs = bookingDate - now;
    const diffH = diffMs / (1000 * 60 * 60);
    if (diffH < 48) {
      return res.status(403).json({ error: 'Cancellazione non consentita: meno di 48 ore alla prenotazione' });
    }
    booking.status = 'cancelled';
    await booking.save();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Errore durante la cancellazione' });
  }
});
const TAVOLI_TOTALI = 110;
const SDRAIO_TOTALI = 65;
const OMBRELLONI_TOTALI = 65;
// Regole di apertura/chiusura specifiche (anno 2026)
function isDateOpen(dateStr) {
  // dateStr expected in YYYY-MM-DD
  if (!dateStr) return false;
  const d = new Date(dateStr + 'T00:00:00');
  if (Number.isNaN(d.getTime())) return false;
  const year = d.getFullYear();
  const month = d.getMonth() + 1; // 1-12
  const day = d.getDate();
  const weekday = d.getDay(); // 0 = Sunday

  // Replicate 2026 rules for years 2026..2036
  const startYear = 2026;
  const endYear = 2036;

  // explicit month-day patterns
  const explicitOpenPatterns = ['04-05', '04-06', '04-25', '05-01'];
  const explicitBlockedPatterns = ['04-07'];

  // build sets for the range of years
  const explicitOpen = new Set();
  const explicitBlocked = new Set();
  for (let y = startYear; y <= endYear; y++) {
    explicitOpenPatterns.forEach(p => explicitOpen.add(`${y}-${p}`));
    explicitBlockedPatterns.forEach(p => explicitBlocked.add(`${y}-${p}`));
  }

  if (explicitBlocked.has(dateStr)) return false;
  if (explicitOpen.has(dateStr)) return true;

  // Open: all days of June, July and August, and 1-13 September for years in range
  if (year >= startYear && year <= endYear) {
    // Allow all Sundays in April and May
    if ((month === 4 || month === 5) && weekday === 0) return true;
    if (month >= 6 && month <= 8) return true;
    if (month === 9 && day >= 1 && day <= 13) return true;
  }

  // Otherwise closed (bookings blocked)
  return false;
}
// Endpoint per ottenere il numero di sdraio disponibili per una data
router.get('/sdraio-disponibili', async (req, res) => {
  try {
    const { date } = req.query;
    if (!date) return res.status(400).json({ error: 'Data richiesta' });
    // Se la data è chiusa per le prenotazioni, rispondi con 0
    if (!isDateOpen(date)) return res.json({ sdraioDisponibili: 0, open: false });
    const prenotazioni = await Booking.aggregate([
      { $match: { status: 'active', date } },
      { $group: { _id: null, totale: { $sum: "$chairs" } } }
    ]);
    const sdraioPrenotate = prenotazioni[0]?.totale || 0;
    const sdraioDisponibili = SDRAIO_TOTALI - sdraioPrenotate;
    res.json({ sdraioDisponibili });
  } catch (error) {
    console.warn('[Booking] Fallback sdraio-disponibili, uso valori statici:', error?.message);
    res.json({ sdraioDisponibili: SDRAIO_TOTALI, open: true, fallback: true });
  }
});

// Endpoint per ottenere il numero di ombrelloni disponibili per una data
router.get('/ombrelloni-disponibili', async (req, res) => {
  try {
    const { date } = req.query;
    if (!date) return res.status(400).json({ error: 'Data richiesta' });
    if (!isDateOpen(date)) return res.json({ ombrelloniDisponibili: 0, open: false });
    const prenotazioni = await Booking.aggregate([
      { $match: { status: 'active', date } },
      { $group: { _id: null, totale: { $sum: "$umbrellas" } } }
    ]);
    const ombrelloniPrenotati = prenotazioni[0]?.totale || 0;
    const ombrelloniDisponibili = OMBRELLONI_TOTALI - ombrelloniPrenotati;
    res.json({ ombrelloniDisponibili });
  } catch (error) {
    console.warn('[Booking] Fallback ombrelloni-disponibili, uso valori statici:', error?.message);
    res.json({ ombrelloniDisponibili: OMBRELLONI_TOTALI, open: true, fallback: true });
  }
});

// Endpoint per ottenere il numero di tavoli disponibili per una data
router.get('/tavoli-disponibili', async (req, res) => {
  try {
    const { date } = req.query;
    if (!date) return res.status(400).json({ error: 'Data richiesta' });
    if (!isDateOpen(date)) return res.json({ tavoliDisponibili: 0, open: false });
    const prenotazioni = await Booking.aggregate([
      { $match: { status: 'active', date } },
      { $group: { _id: null, totale: { $sum: "$tables" } } }
    ]);
    const tavoliPrenotati = prenotazioni[0]?.totale || 0;
    const tavoliDisponibili = TAVOLI_TOTALI - tavoliPrenotati;
    res.json({ tavoliDisponibili });
  } catch (error) {
    console.warn('[Booking] Fallback tavoli-disponibili, uso valori statici:', error?.message);
    res.json({ tavoliDisponibili: TAVOLI_TOTALI, open: true, fallback: true });
  }
});

export default (app) => {
  app.use('/api/booking', router);
};
