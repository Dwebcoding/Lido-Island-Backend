// Booking route (ESM) - No auth required
import express from 'express';
import Stripe from 'stripe';
import Booking from '../models/booking.js';
import Donation from '../models/donation.js';
import mailer from '../services/mailer.js';

const router = express.Router();
const TAVOLI_TOTALI = 110;
const SDRAIO_TOTALI = 65;
const OMBRELLONI_TOTALI = 65;
const PARTIAL_REFUND_STATUS = 'partially_refunded';
const FULL_REFUND_STATUS = 'refunded';

function requireAdminAccess(req, res, next) {
  const configuredAdminKey = String(process.env.BOOKING_ADMIN_KEY || '').trim();
  if (!configuredAdminKey) {
    console.error('[Booking] BOOKING_ADMIN_KEY mancante');
    return res.status(503).json({ error: 'Area amministrativa non configurata' });
  }

  const providedAdminKey = String(req.get('x-admin-key') || '').trim();
  if (!providedAdminKey || providedAdminKey !== configuredAdminKey) {
    return res.status(401).json({ error: 'Accesso non autorizzato' });
  }

  return next();
}

function toInt(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}



function parseBookingMetadata(rawBooking) {
  if (typeof rawBooking !== 'string') return {};
  const trimmed = rawBooking.trim();
  if (!trimmed || (!trimmed.startsWith('{') && !trimmed.startsWith('['))) return {};
  try {
    return JSON.parse(trimmed);
  } catch (_error) {
    return {};
  }
}

function isBookingPayload(bookingData) {
  const tables = Number(bookingData?.tables || 0);
  const chairs = Number(bookingData?.chairs || 0);
  const umbrellas = Number(bookingData?.umbrellas || 0);
  return Boolean(bookingData?.date) && (tables + chairs + umbrellas) > 0;
}

function normalizeSessionPaymentStatus(session) {
  const baseStatus = String(session?.payment_status || '').toLowerCase();
  const latestCharge = session?.payment_intent && typeof session.payment_intent === 'object'
    ? session.payment_intent.latest_charge
    : null;
  const amountRefunded = Number(latestCharge?.amount_refunded || 0);
  const amountTotal = Number(session?.amount_total || 0);

  if (amountTotal > 0 && amountRefunded >= amountTotal) return FULL_REFUND_STATUS;
  if (amountRefunded > 0) return PARTIAL_REFUND_STATUS;
  return baseStatus;
}

function getBookingStatusFromPaymentStatus(paymentStatus) {
  const normalizedStatus = String(paymentStatus || '').toLowerCase();
  if (normalizedStatus === 'paid' || normalizedStatus === PARTIAL_REFUND_STATUS) {
    return 'active';
  }

  return 'cancelled';
}

function getBookingSort(sortByRaw) {
  const sortBy = String(sortByRaw || '').toLowerCase();
  if (sortBy === 'desc' || sortBy === 'newest') return { paidAt: -1, createdAt: -1, _id: -1 };
  if (sortBy === 'asc' || sortBy === 'oldest') return { paidAt: 1, createdAt: 1, _id: 1 };
  if (sortBy === 'event_asc') return { date: 1, paidAt: -1, _id: -1 };
  if (sortBy === 'event_desc') return { date: -1, paidAt: -1, _id: -1 };
  if (sortBy === 'amount_desc') return { amount: -1, paidAt: -1, _id: -1 };
  if (sortBy === 'amount_asc') return { amount: 1, paidAt: -1, _id: -1 };
  return { paidAt: -1, createdAt: -1, _id: -1 };
}

function getDonationSort(sortByRaw) {
  const sortBy = String(sortByRaw || '').toLowerCase();
  if (sortBy === 'desc' || sortBy === 'newest') return { paidAt: -1, createdAt: -1, _id: -1 };
  if (sortBy === 'asc' || sortBy === 'oldest') return { paidAt: 1, createdAt: 1, _id: 1 };
  if (sortBy === 'amount_desc') return { amount: -1, paidAt: -1, _id: -1 };
  if (sortBy === 'amount_asc') return { amount: 1, paidAt: -1, _id: -1 };
  return { paidAt: -1, createdAt: -1, _id: -1 };
}

function buildBookingNotes(notes, tableNumbers) {
  const normalizedNotes = String(notes || '').trim();
  const normalizedTableNumbers = Array.isArray(tableNumbers)
    ? tableNumbers
      .map((n) => Number(n))
      .filter((n) => Number.isInteger(n) && n >= 1 && n <= TAVOLI_TOTALI)
      .sort((left, right) => left - right)
    : [];

  if (!normalizedTableNumbers.length) return normalizedNotes;

  const tablesLine = `Tavoli: ${normalizedTableNumbers.join(', ')}`;
  if (!normalizedNotes) return tablesLine;
  if (/tavoli\s*:/i.test(normalizedNotes)) return normalizedNotes;

  return `${normalizedNotes}\n${tablesLine}`;
}

function buildAdminCancellationNotes(notes) {
  const normalizedNotes = String(notes || '').trim();
  const cancellationLine = 'Annullata manualmente dal gestionale.';
  if (!normalizedNotes) return cancellationLine;
  if (normalizedNotes.includes(cancellationLine)) return normalizedNotes;
  return `${normalizedNotes}\n${cancellationLine}`;
}

// Cancellazione prenotazione gratuita fino a 48h prima
router.patch('/cancella', async (req, res) => {
  try {
    const { email, date } = req.body || {};
    if (!email || !date) return res.status(400).json({ error: 'Email e data richieste' });

    const booking = await Booking.findOne({ email, date, status: 'active' });
    if (!booking) return res.status(404).json({ error: 'Prenotazione non trovata' });

    const now = new Date();
    const bookingDate = new Date(`${date}T00:00:00`);
    const diffMs = bookingDate - now;
    const diffH = diffMs / (1000 * 60 * 60);
    if (diffH < 48) {
      return res.status(403).json({ error: 'Cancellazione non consentita: meno di 48 ore alla prenotazione' });
    }

    booking.status = 'cancelled';
    await booking.save();
    return res.json({ success: true });
  } catch (_error) {
    return res.status(500).json({ error: 'Errore durante la cancellazione' });
  }
});

router.patch('/admin-cancel/:id', requireAdminAccess, async (req, res) => {
  try {
    const id = String(req.params.id || '').trim();
    if (!id) return res.status(400).json({ error: 'ID prenotazione richiesto' });

    const booking = await Booking.findById(id);
    if (!booking) return res.status(404).json({ error: 'Prenotazione non trovata' });

    if (String(booking.status || '').toLowerCase() === 'cancelled') {
      return res.json({
        success: true,
        alreadyCancelled: true,
        item: {
          id: booking._id,
          bookingId: booking.bookingId || '',
          status: booking.status || 'cancelled'
        }
      });
    }

    booking.status = 'cancelled';
    booking.notes = buildAdminCancellationNotes(booking.notes);
    await booking.save();

    return res.json({
      success: true,
      item: {
        id: booking._id,
        bookingId: booking.bookingId || '',
        status: booking.status || 'cancelled'
      }
    });
  } catch (error) {
    console.error('[Booking] /admin-cancel error:', error);
    return res.status(500).json({ error: 'Errore durante l\'annullamento amministrativo' });
  }
});

// Lista prenotazioni per gestionale
router.get('/lista', requireAdminAccess, async (req, res) => {
  try {
    const date = String(req.query.date || '').trim();
    const status = String(req.query.status || '').trim();
    const limit = Math.min(Math.max(toInt(req.query.limit, 100), 1), 500);
    const sort = getBookingSort(req.query.sortBy || req.query.sort || 'newest');

    const match = {
      ...(date ? { date } : {}),
      ...(status ? { status } : {})
    };

    const bookings = await Booking.find(match)
      .sort(sort)
      .limit(limit)
      .lean();

    return res.json({
      count: bookings.length,
      items: bookings.map((b) => ({
        id: b._id,
        bookingId: b.bookingId || '',
        date: b.date,
        name: b.name || '',
        email: b.email || '',
        phone: b.phone || '',
        notes: buildBookingNotes(b.notes, b.tableNumbers),
        tables: b.tables || 0,
        tableNumbers: Array.isArray(b.tableNumbers) ? b.tableNumbers : [],
        chairs: b.chairs || 0,
        umbrellas: b.umbrellas || 0,
        amount: b.amount || 0,
        paymentId: b.paymentId || '',
        paymentStatus: b.paymentStatus || '',
        status: b.status || 'active',
        source: b.source || '',
        paidAt: b.paidAt || null,
        createdAt: b.createdAt || null
      }))
    });
  } catch (error) {
    console.error('[Booking] /lista error:', error);
    return res.status(500).json({ error: 'Errore nel recupero prenotazioni' });
  }
});

// Riepilogo quantitativi prenotati per data
router.get('/stats', requireAdminAccess, async (req, res) => {
  try {
    const date = String(req.query.date || '').trim();
    const match = {
      status: 'active',
      ...(date ? { date } : {})
    };

    const [agg] = await Booking.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          tablesBooked: { $sum: '$tables' },
          chairsBooked: { $sum: '$chairs' },
          umbrellasBooked: { $sum: '$umbrellas' },
          totalAmount: { $sum: '$amount' },
          bookings: { $sum: 1 }
        }
      }
    ]);

    const stats = agg || {
      tablesBooked: 0,
      chairsBooked: 0,
      umbrellasBooked: 0,
      totalAmount: 0,
      bookings: 0
    };

    return res.json({
      date: date || null,
      bookings: stats.bookings,
      tablesBooked: stats.tablesBooked,
      chairsBooked: stats.chairsBooked,
      umbrellasBooked: stats.umbrellasBooked,
      tablesAvailable: Math.max(TAVOLI_TOTALI - stats.tablesBooked, 0),
      chairsAvailable: Math.max(SDRAIO_TOTALI - stats.chairsBooked, 0),
      umbrellasAvailable: Math.max(OMBRELLONI_TOTALI - stats.umbrellasBooked, 0),
      totalAmount: stats.totalAmount
    });
  } catch (error) {
    console.error('[Booking] /stats error:', error);
    return res.status(500).json({ error: 'Errore nel recupero statistiche' });
  }
});

// Lista donazioni per gestionale
router.get('/donazioni', requireAdminAccess, async (req, res) => {
  try {
    const date = String(req.query.date || '').trim();
    const limit = Math.min(Math.max(toInt(req.query.limit, 100), 1), 500);
    const sort = getDonationSort(req.query.sortBy || req.query.sort || 'newest');

    const donations = await Donation.find(date ? { paidAt: { $gte: new Date(`${date}T00:00:00`), $lte: new Date(`${date}T23:59:59.999`) } } : {})
      .sort(sort)
      .limit(limit)
      .lean();

    return res.json({
      count: donations.length,
      items: donations.map((d) => ({
        id: d._id,
        donorName: d.donorName || '',
        donorEmail: d.donorEmail || '',
        message: d.message || '',
        amount: d.amount || 0,
        paymentId: d.paymentId || '',
        paymentStatus: d.paymentStatus || '',
        donationType: d.donationType || 'generic',
        status: d.status || 'active',
        paidAt: d.paidAt || null,
        createdAt: d.createdAt || null
      }))
    });
  } catch (error) {
    console.error('[Booking] /donazioni error:', error);
    return res.status(500).json({ error: 'Errore nel recupero donazioni' });
  }
});

// Riepilogo donazioni
router.get('/donazioni-stats', requireAdminAccess, async (req, res) => {
  try {
    const date = String(req.query.date || '').trim();
    const match = date
      ? { paidAt: { $gte: new Date(`${date}T00:00:00`), $lte: new Date(`${date}T23:59:59.999`) } }
      : {};

    const [agg] = await Donation.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          donations: { $sum: 1 },
          totalAmount: { $sum: '$amount' }
        }
      }
    ]);

    return res.json({
      donations: agg?.donations || 0,
      totalAmount: agg?.totalAmount || 0
    });
  } catch (error) {
    console.error('[Booking] /donazioni-stats error:', error);
    return res.status(500).json({ error: 'Errore nel recupero statistiche donazioni' });
  }
});

// Sync forzato da Stripe -> DB (prenotazioni + donazioni)
router.post('/sync-stripe', requireAdminAccess, async (req, res) => {
  try {
    const stripeSecret = (process.env.STRIPE_SECRET_KEY || '').trim();
    if (!stripeSecret) return res.status(503).json({ error: 'STRIPE_SECRET_KEY mancante' });

    const stripe = new Stripe(stripeSecret, { apiVersion: null });
    const limit = Math.min(Math.max(toInt(req.query.limit, 100), 1), 100);
    const sessions = await stripe.checkout.sessions.list({
      limit,
      expand: ['data.payment_intent.latest_charge']
    });

    let bookingsUpserted = 0;
    let donationsUpserted = 0;
    let skipped = 0;
    let conflicts = 0;

    for (const session of sessions.data || []) {
      const paymentStatus = normalizeSessionPaymentStatus(session);
      const bookingStatus = getBookingStatusFromPaymentStatus(paymentStatus);

      const metadata = session?.metadata || {};
      const bookingData = parseBookingMetadata(metadata.booking);
      const paidAt = session?.created ? new Date(session.created * 1000) : new Date();

      if (isBookingPayload(bookingData)) {
        const incomingTableNumbers = Array.isArray(bookingData.tableNumbers)
          ? bookingData.tableNumbers.map((n) => Number(n)).filter((n) => Number.isInteger(n) && n >= 1 && n <= TAVOLI_TOTALI)
          : [];
        const existingBooking = await Booking.findOne({ paymentId: session.id }).select('_id').lean();
        if (bookingStatus !== 'active' && !existingBooking) {
          skipped++;
          continue;
        }

        const payload = {
          bookingId: bookingData.id || bookingData.bookingId || `ISOLA-${Date.now()}-${String(session.id || '').slice(-8).toUpperCase()}`,
          date: bookingData.date || '',
          name: bookingData.name || '',
          email: session.customer_email || bookingData.email || '',
          phone: bookingData.phone || '',
          notes: bookingData.notes || '',
          tables: incomingTableNumbers.length > 0 ? incomingTableNumbers.length : Number(bookingData.tables || 0),
          tableNumbers: incomingTableNumbers,
          chairs: Number(bookingData.chairs || 0),
          umbrellas: Number(bookingData.umbrellas || 0),
          amount: Number(session.amount_total || 0),
          paymentId: session.id || '',
          paymentStatus,
          status: bookingStatus,
          source: 'stripe_sync',
          paidAt
        };

        if (bookingStatus === 'active' && incomingTableNumbers.length > 0 && payload.date) {
          const conflict = await Booking.findOne({
            status: 'active',
            date: payload.date,
            paymentId: { $ne: payload.paymentId },
            tableNumbers: { $in: incomingTableNumbers }
          }).lean();
          if (conflict) {
            conflicts++;
            skipped++;
            continue;
          }
        }

        const bookingDoc = await Booking.findOneAndUpdate(
          { paymentId: payload.paymentId },
          { $set: payload },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );
        bookingsUpserted++;

        if (bookingStatus === 'active') {
          try {
            await mailer.sendOwnerNotification({ booking: bookingDoc, amount: payload.amount, notifyCustomer: true });
          } catch (mailErr) {
            console.warn('[Booking] Email notification failed during sync:', mailErr);
          }
        }
      } else {
        const existingDonation = await Donation.findOne({ paymentId: session.id }).select('_id').lean();
        if (bookingStatus !== 'active' && !existingDonation) {
          skipped++;
          continue;
        }

        const donationPayload = {
          donorName: metadata.donation_name || '',
          donorEmail: session.customer_email || '',
          message: metadata.donation_message || '',
          amount: Number(session.amount_total || 0),
          paymentId: session.id || '',
          paymentStatus,
          donationType: metadata.donation_type || 'generic',
          status: bookingStatus,
          source: 'stripe_sync',
          paidAt
        };

        await Donation.findOneAndUpdate(
          { paymentId: donationPayload.paymentId },
          { $set: donationPayload },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );
        donationsUpserted++;
      }
    }

    return res.json({
      synced: true,
      totalSessionsRead: sessions.data?.length || 0,
      bookingsUpserted,
      donationsUpserted,
      conflicts,
      skipped
    });
  } catch (error) {
    console.error('[Booking] /sync-stripe error:', error);
    return res.status(500).json({ error: 'Errore sincronizzazione Stripe', details: error?.message || 'unknown' });
  }
});

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

router.get('/sdraio-disponibili', async (req, res) => {
  try {
    const { date } = req.query;
    if (!date) return res.status(400).json({ error: 'Data richiesta' });
    if (!isDateOpen(date)) return res.json({ sdraioDisponibili: 0, open: false });

    const prenotazioni = await Booking.aggregate([
      { $match: { status: 'active', date } },
      { $group: { _id: null, totale: { $sum: '$chairs' } } }
    ]);
    const sdraioPrenotate = prenotazioni[0]?.totale || 0;
    const sdraioDisponibili = SDRAIO_TOTALI - sdraioPrenotate;
    return res.json({ sdraioDisponibili });
  } catch (error) {
    console.warn('[Booking] Fallback sdraio-disponibili, uso valori statici:', error?.message);
    return res.json({ sdraioDisponibili: SDRAIO_TOTALI, open: true, fallback: true });
  }
});

router.get('/ombrelloni-disponibili', async (req, res) => {
  try {
    const { date } = req.query;
    if (!date) return res.status(400).json({ error: 'Data richiesta' });
    if (!isDateOpen(date)) return res.json({ ombrelloniDisponibili: 0, open: false });

    const prenotazioni = await Booking.aggregate([
      { $match: { status: 'active', date } },
      { $group: { _id: null, totale: { $sum: '$umbrellas' } } }
    ]);
    const ombrelloniPrenotati = prenotazioni[0]?.totale || 0;
    const ombrelloniDisponibili = OMBRELLONI_TOTALI - ombrelloniPrenotati;
    return res.json({ ombrelloniDisponibili });
  } catch (error) {
    console.warn('[Booking] Fallback ombrelloni-disponibili, uso valori statici:', error?.message);
    return res.json({ ombrelloniDisponibili: OMBRELLONI_TOTALI, open: true, fallback: true });
  }
});

router.get('/tavoli-disponibili', async (req, res) => {
  try {
    const { date } = req.query;
    if (!date) return res.status(400).json({ error: 'Data richiesta' });
    if (!isDateOpen(date)) return res.json({ tavoliDisponibili: 0, open: false });

    const prenotazioni = await Booking.aggregate([
      { $match: { status: 'active', date } },
      { $group: { _id: null, totale: { $sum: '$tables' } } }
    ]);
    const tavoliPrenotati = prenotazioni[0]?.totale || 0;
    const tavoliDisponibili = TAVOLI_TOTALI - tavoliPrenotati;
    return res.json({ tavoliDisponibili });
  } catch (error) {
    console.warn('[Booking] Fallback tavoli-disponibili, uso valori statici:', error?.message);
    return res.json({ tavoliDisponibili: TAVOLI_TOTALI, open: true, fallback: true });
  }
});

// Elenco numeri tavolo gia occupati per una data
router.get('/tavoli-occupati', async (req, res) => {
  try {
    const { date } = req.query;
    if (!date) return res.status(400).json({ error: 'Data richiesta' });
    if (!isDateOpen(date)) return res.json({ tavoliOccupati: [], open: false });

    const bookings = await Booking.find(
      { status: 'active', date, tableNumbers: { $exists: true, $ne: [] } },
      { tableNumbers: 1, _id: 0 }
    ).lean();

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

export default (app) => {
  app.use('/api/booking', router);
};
