import express from 'express';
import Stripe from 'stripe';
import { randomUUID } from 'crypto';
import Booking from '../models/booking.js';
import Donation from '../models/donation.js';
import mailer from '../services/mailer.js';
import {
  acquireCustomerConfirmationLock,
  hasCustomerConfirmationBeenSent,
  markCustomerConfirmationSent,
  releaseCustomerConfirmationLock
} from '../services/booking-notification-state.js';

const router = express.Router();
const TAVOLI_TOTALI = 110;
const SDRAIO_TOTALI = 65;
const OMBRELLONI_TOTALI = 65;
const PARTIAL_REFUND_STATUS = 'partially_refunded';
const FULL_REFUND_STATUS = 'refunded';
const MANUAL_PAYMENT_STATUS = 'manuale';

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

function toNonNegativeInt(value, fallback = 0) {
  const parsed = toInt(value, fallback);
  return parsed >= 0 ? parsed : fallback;
}

function normalizeText(value, fallback = '') {
  return typeof value === 'string' ? value.trim() : fallback;
}

function normalizeEmail(value) {
  return normalizeText(value).toLowerCase();
}

function isValidDateString(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || '').trim());
}

function normalizeTableNumbers(value) {
  const rawItems = Array.isArray(value)
    ? value
    : String(value || '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);

  const unique = new Set();
  for (const item of rawItems) {
    const number = Number(item);
    if (Number.isInteger(number) && number >= 1 && number <= TAVOLI_TOTALI) unique.add(number);
  }

  return Array.from(unique).sort((left, right) => left - right);
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
  const normalizedTableNumbers = normalizeTableNumbers(tableNumbers);

  if (!normalizedTableNumbers.length) return normalizedNotes;

  const tablesLine = `Tavoli: ${normalizedTableNumbers.join(', ')}`;
  if (!normalizedNotes) return tablesLine;
  if (/tavoli\s*:/i.test(normalizedNotes)) return normalizedNotes;

  return `${normalizedNotes}\n${tablesLine}`;
}

function appendAdminAuditNote(notes, line) {
  const normalizedNotes = String(notes || '').trim();
  const normalizedLine = String(line || '').trim();
  if (!normalizedLine) return normalizedNotes;
  if (!normalizedNotes) return normalizedLine;
  if (normalizedNotes.includes(normalizedLine)) return normalizedNotes;
  return `${normalizedNotes}\n${normalizedLine}`;
}

function buildAdminCancellationNotes(notes) {
  return appendAdminAuditNote(notes, 'Annullata manualmente dal gestionale.');
}

function buildAdminRestoreNotes(notes) {
  return appendAdminAuditNote(notes, 'Riattivata manualmente dal gestionale.');
}

function buildRefundNotes(notes, amountCents, reason) {
  const amountLabel = `Rimborso registrato: ${(Number(amountCents || 0) / 100).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })}`;
  const line = reason ? `${amountLabel} (${reason})` : amountLabel;
  return appendAdminAuditNote(notes, line);
}

function createStripeClient() {
  const stripeSecret = String(process.env.STRIPE_SECRET_KEY || '').trim();
  if (!stripeSecret) return null;
  try {
    return new Stripe(stripeSecret, { apiVersion: null });
  } catch (error) {
    console.error('[Booking] Stripe init error:', error);
    return null;
  }
}

const stripeClient = createStripeClient();

function generateBookingId() {
  return `ADM-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${randomUUID().slice(0, 8).toUpperCase()}`;
}

function serializeBooking(booking) {
  const item = typeof booking?.toObject === 'function' ? booking.toObject() : booking;
  const refundedAmount = Number(item?.refundedAmount || 0);
  const amount = Number(item?.amount || 0);
  return {
    id: item?._id,
    bookingId: item?.bookingId || '',
    date: item?.date || '',
    name: item?.name || '',
    email: item?.email || '',
    phone: item?.phone || '',
    notes: buildBookingNotes(item?.notes || '', item?.tableNumbers || []),
    tables: Number(item?.tables || 0),
    tableNumbers: normalizeTableNumbers(item?.tableNumbers || []),
    chairs: Number(item?.chairs || 0),
    umbrellas: Number(item?.umbrellas || 0),
    amount,
    refundedAmount,
    refundableAmount: Math.max(amount - refundedAmount, 0),
    paymentId: item?.paymentId || '',
    paymentIntentId: item?.paymentIntentId || '',
    paymentStatus: item?.paymentStatus || '',
    status: item?.status || 'active',
    source: item?.source || '',
    paidAt: item?.paidAt || null,
    createdAt: item?.createdAt || null,
    updatedAt: item?.updatedAt || null,
    lastRefundAt: item?.lastRefundAt || null,
    lastRefundId: item?.lastRefundId || '',
    hasStripePayment: Boolean(item?.paymentId)
  };
}

function getStripeMetadataForBooking(booking, adminAction = 'updated') {
  const bookingPayload = {
    id: booking.bookingId || booking._id?.toString() || '',
    bookingId: booking.bookingId || booking._id?.toString() || '',
    date: booking.date || '',
    name: booking.name || '',
    email: booking.email || '',
    phone: booking.phone || '',
    notes: booking.notes || '',
    tables: Number(booking.tables || 0),
    tableNumbers: normalizeTableNumbers(booking.tableNumbers || []),
    chairs: Number(booking.chairs || 0),
    umbrellas: Number(booking.umbrellas || 0),
    paymentStatus: booking.paymentStatus || '',
    status: booking.status || 'active',
    source: booking.source || ''
  };

  return {
    booking: JSON.stringify(bookingPayload),
    booking_id: booking.bookingId || booking._id?.toString() || '',
    booking_date: booking.date || '',
    booking_name: booking.name || '',
    booking_email: booking.email || '',
    booking_phone: booking.phone || '',
    booking_tables: String(Number(booking.tables || 0)),
    booking_table_numbers: normalizeTableNumbers(booking.tableNumbers || []).join(','),
    booking_chairs: String(Number(booking.chairs || 0)),
    booking_umbrellas: String(Number(booking.umbrellas || 0)),
    booking_status: booking.status || 'active',
    booking_payment_status: booking.paymentStatus || '',
    booking_source: booking.source || '',
    booking_admin_action: adminAction,
    booking_refunded_amount: String(Number(booking.refundedAmount || 0))
  };
}

async function resolveStripeSessionForBooking(booking) {
  if (!stripeClient || !booking?.paymentId) return null;

  try {
    return await stripeClient.checkout.sessions.retrieve(booking.paymentId, {
      expand: ['payment_intent.latest_charge']
    });
  } catch (error) {
    console.warn('[Booking] Stripe session retrieve failed:', error?.message || error);
    return null;
  }
}

function getRefundedAmountFromSession(session) {
  const latestCharge = session?.payment_intent && typeof session.payment_intent === 'object'
    ? session.payment_intent.latest_charge
    : null;
  return Number(latestCharge?.amount_refunded || 0);
}

async function syncStripeBookingMetadata(booking, adminAction = 'updated') {
  if (!stripeClient || !booking?.paymentId) return { synced: false };

  const metadata = getStripeMetadataForBooking(booking, adminAction);
  let sessionSynced = false;
  let paymentIntentSynced = false;
  let paymentIntentId = normalizeText(booking.paymentIntentId);

  try {
    await stripeClient.checkout.sessions.update(booking.paymentId, { metadata });
    sessionSynced = true;
  } catch (error) {
    console.warn('[Booking] Stripe checkout session update failed:', error?.message || error);
  }

  if (!paymentIntentId) {
    const session = await resolveStripeSessionForBooking(booking);
    paymentIntentId = normalizeText(session?.payment_intent?.id || session?.payment_intent);
    if (paymentIntentId && paymentIntentId !== booking.paymentIntentId) {
      booking.paymentIntentId = paymentIntentId;
      await booking.save();
    }
  }

  if (paymentIntentId) {
    try {
      await stripeClient.paymentIntents.update(paymentIntentId, { metadata });
      paymentIntentSynced = true;
    } catch (error) {
      console.warn('[Booking] Stripe payment intent update failed:', error?.message || error);
    }
  }

  return {
    synced: sessionSynced || paymentIntentSynced,
    sessionSynced,
    paymentIntentSynced
  };
}

async function collectAvailabilityUsage(date, excludeId) {
  const match = {
    status: 'active',
    date,
    ...(excludeId ? { _id: { $ne: excludeId } } : {})
  };

  const [resourceTotals, conflictingBookings] = await Promise.all([
    Booking.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          chairsBooked: { $sum: '$chairs' },
          umbrellasBooked: { $sum: '$umbrellas' }
        }
      }
    ]),
    Booking.find(
      {
        ...match,
        tableNumbers: { $exists: true, $ne: [] }
      },
      { tableNumbers: 1, bookingId: 1, name: 1 }
    ).lean()
  ]);

  const usedTableMap = new Map();
  for (const item of conflictingBookings) {
    for (const tableNumber of normalizeTableNumbers(item.tableNumbers || [])) {
      if (!usedTableMap.has(tableNumber)) {
        usedTableMap.set(tableNumber, {
          bookingId: item.bookingId || '',
          name: item.name || ''
        });
      }
    }
  }

  return {
    chairsBooked: Number(resourceTotals?.[0]?.chairsBooked || 0),
    umbrellasBooked: Number(resourceTotals?.[0]?.umbrellasBooked || 0),
    usedTableMap
  };
}

async function assertBookingAvailability({ date, tableNumbers, chairs, umbrellas, excludeId }) {
  if (!isValidDateString(date)) {
    const error = new Error('Data prenotazione non valida');
    error.statusCode = 400;
    throw error;
  }

  const normalizedTables = normalizeTableNumbers(tableNumbers);
  const normalizedChairs = toNonNegativeInt(chairs, 0);
  const normalizedUmbrellas = toNonNegativeInt(umbrellas, 0);
  const usage = await collectAvailabilityUsage(date, excludeId);

  const conflictingTableNumbers = normalizedTables.filter((tableNumber) => usage.usedTableMap.has(tableNumber));
  if (conflictingTableNumbers.length > 0) {
    const conflictLabel = conflictingTableNumbers.join(', ');
    const error = new Error(`I tavoli ${conflictLabel} risultano gia occupati per la data selezionata`);
    error.statusCode = 409;
    error.details = { conflictingTableNumbers };
    throw error;
  }

  if (usage.chairsBooked + normalizedChairs > SDRAIO_TOTALI) {
    const availableChairs = Math.max(SDRAIO_TOTALI - usage.chairsBooked, 0);
    const error = new Error(`Sdraio insufficienti: disponibili ${availableChairs} sulla data selezionata`);
    error.statusCode = 409;
    throw error;
  }

  if (usage.umbrellasBooked + normalizedUmbrellas > OMBRELLONI_TOTALI) {
    const availableUmbrellas = Math.max(OMBRELLONI_TOTALI - usage.umbrellasBooked, 0);
    const error = new Error(`Ombrelloni insufficienti: disponibili ${availableUmbrellas} sulla data selezionata`);
    error.statusCode = 409;
    throw error;
  }
}

function getAdminSource(source, paymentId, fallback = 'manual_admin') {
  if (paymentId) return normalizeText(source, 'stripe_checkout') || 'stripe_checkout';
  return normalizeText(source, fallback) || fallback;
}

function normalizeAdminBookingPayload(input = {}, existingBooking = null) {
  const date = normalizeText(input.date, existingBooking?.date || '');
  const tableNumbers = normalizeTableNumbers(input.tableNumbers ?? existingBooking?.tableNumbers ?? []);
  const tables = tableNumbers.length > 0
    ? tableNumbers.length
    : toNonNegativeInt(input.tables, existingBooking?.tables || 0);
  const chairs = toNonNegativeInt(input.chairs, existingBooking?.chairs || 0);
  const umbrellas = toNonNegativeInt(input.umbrellas, existingBooking?.umbrellas || 0);
  const amount = toNonNegativeInt(input.amount, existingBooking?.amount || 0);
  const paymentId = normalizeText(input.paymentId, existingBooking?.paymentId || '');
  const paymentIntentId = normalizeText(input.paymentIntentId, existingBooking?.paymentIntentId || '');
  const refundedAmount = toNonNegativeInt(input.refundedAmount, existingBooking?.refundedAmount || 0);
  const statusCandidate = normalizeText(input.status, existingBooking?.status || 'active').toLowerCase();
  const status = statusCandidate === 'cancelled' ? 'cancelled' : 'active';
  const source = getAdminSource(input.source, paymentId, existingBooking?.source || 'manual_admin');
  const fallbackPaymentStatus = paymentId ? 'paid' : MANUAL_PAYMENT_STATUS;
  const paymentStatus = normalizeText(input.paymentStatus, existingBooking?.paymentStatus || fallbackPaymentStatus) || fallbackPaymentStatus;

  if (!isValidDateString(date)) {
    const error = new Error('Data prenotazione obbligatoria o non valida');
    error.statusCode = 400;
    throw error;
  }

  if (tables + chairs + umbrellas <= 0) {
    const error = new Error('Inserisci almeno un tavolo, una sdraio oppure un ombrellone');
    error.statusCode = 400;
    throw error;
  }

  if (tableNumbers.length > 0 && tables !== tableNumbers.length) {
    const error = new Error('Il numero tavoli deve coincidere con i numeri tavolo selezionati');
    error.statusCode = 400;
    throw error;
  }

  const fallbackName = existingBooking?.name || (tableNumbers.length > 0 ? 'Prenotazione manuale' : 'Prenotazione amministrativa');

  return {
    bookingId: normalizeText(input.bookingId, existingBooking?.bookingId || '') || generateBookingId(),
    date,
    name: normalizeText(input.name, fallbackName),
    email: normalizeEmail(input.email ?? existingBooking?.email ?? ''),
    phone: normalizeText(input.phone, existingBooking?.phone || ''),
    notes: normalizeText(input.notes, existingBooking?.notes || ''),
    tables,
    tableNumbers,
    chairs,
    umbrellas,
    amount,
    refundedAmount: Math.min(refundedAmount, amount),
    paymentId,
    paymentIntentId,
    paymentStatus,
    status,
    source,
    paidAt: existingBooking?.paidAt || new Date()
  };
}

async function sendAdminBookingEmails(booking) {
  try {
    await mailer.sendOwnerNotification({
      booking,
      amount: booking.amount || 0,
      notifyCustomer: true
    });
  } catch (error) {
    console.warn('[Booking] Admin email notification failed:', error?.message || error);
  }
}

async function sendCustomerConfirmationOnce(booking, amount) {
  if (!booking?._id) return false;
  if (!booking?.email || !booking.email.includes('@')) return false;
  if (hasCustomerConfirmationBeenSent(booking)) return false;

  const lockAcquired = await acquireCustomerConfirmationLock(booking._id);
  if (!lockAcquired) return false;

  try {
    const sent = await mailer.sendCustomerConfirmation({
      to: booking.email,
      booking,
      amount
    });

    if (sent) {
      await markCustomerConfirmationSent(booking._id);
      booking.customerConfirmationSentAt = new Date();
      booking.customerConfirmationSendingAt = null;
      return true;
    }

    await releaseCustomerConfirmationLock(booking._id);
    booking.customerConfirmationSendingAt = null;
    return false;
  } catch (error) {
    await releaseCustomerConfirmationLock(booking._id);
    booking.customerConfirmationSendingAt = null;
    throw error;
  }
}

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

router.post('/admin-bookings', requireAdminAccess, async (req, res) => {
  try {
    const payload = normalizeAdminBookingPayload(req.body);

    if (payload.status === 'active') {
      await assertBookingAvailability({
        date: payload.date,
        tableNumbers: payload.tableNumbers,
        chairs: payload.chairs,
        umbrellas: payload.umbrellas
      });
    }

    const booking = await Booking.create({
      ...payload,
      notes: buildBookingNotes(payload.notes, payload.tableNumbers)
    });

    const stripeSync = await syncStripeBookingMetadata(booking, 'created');
    await sendAdminBookingEmails(booking);

    return res.status(201).json({
      success: true,
      stripeSync,
      item: serializeBooking(booking)
    });
  } catch (error) {
    console.error('[Booking] /admin-bookings create error:', error);
    return res.status(error.statusCode || 500).json({ error: error.message || 'Errore creazione prenotazione amministrativa', details: error.details || undefined });
  }
});

router.patch('/admin-bookings/:id', requireAdminAccess, async (req, res) => {
  try {
    const id = normalizeText(req.params.id);
    if (!id) return res.status(400).json({ error: 'ID prenotazione richiesto' });

    const booking = await Booking.findById(id);
    if (!booking) return res.status(404).json({ error: 'Prenotazione non trovata' });

    const payload = normalizeAdminBookingPayload(req.body, booking);
    const isActivating = payload.status === 'active';

    if (isActivating && payload.refundedAmount >= payload.amount && payload.amount > 0) {
      return res.status(409).json({ error: 'Non puoi riattivare una prenotazione gia rimborsata totalmente' });
    }

    if (isActivating) {
      await assertBookingAvailability({
        date: payload.date,
        tableNumbers: payload.tableNumbers,
        chairs: payload.chairs,
        umbrellas: payload.umbrellas,
        excludeId: booking._id
      });
    }

    booking.bookingId = payload.bookingId;
    booking.date = payload.date;
    booking.name = payload.name;
    booking.email = payload.email;
    booking.phone = payload.phone;
    booking.notes = buildBookingNotes(payload.notes, payload.tableNumbers);
    booking.tables = payload.tables;
    booking.tableNumbers = payload.tableNumbers;
    booking.chairs = payload.chairs;
    booking.umbrellas = payload.umbrellas;
    booking.amount = payload.amount;
    booking.refundedAmount = payload.refundedAmount;
    booking.paymentId = payload.paymentId;
    booking.paymentIntentId = payload.paymentIntentId;
    booking.paymentStatus = payload.paymentStatus;
    booking.status = payload.status;
    booking.source = payload.source;
    await booking.save();

    const stripeSync = await syncStripeBookingMetadata(booking, 'updated');

    return res.json({
      success: true,
      stripeSync,
      item: serializeBooking(booking)
    });
  } catch (error) {
    console.error('[Booking] /admin-bookings update error:', error);
    return res.status(error.statusCode || 500).json({ error: error.message || 'Errore aggiornamento prenotazione amministrativa', details: error.details || undefined });
  }
});

router.patch('/admin-cancel/:id', requireAdminAccess, async (req, res) => {
  try {
    const id = normalizeText(req.params.id);
    if (!id) return res.status(400).json({ error: 'ID prenotazione richiesto' });

    const booking = await Booking.findById(id);
    if (!booking) return res.status(404).json({ error: 'Prenotazione non trovata' });

    if (String(booking.status || '').toLowerCase() === 'cancelled') {
      return res.json({
        success: true,
        alreadyCancelled: true,
        item: serializeBooking(booking)
      });
    }

    booking.status = 'cancelled';
    booking.notes = buildAdminCancellationNotes(booking.notes);
    await booking.save();
    const stripeSync = await syncStripeBookingMetadata(booking, 'cancelled');

    return res.json({
      success: true,
      stripeSync,
      item: serializeBooking(booking)
    });
  } catch (error) {
    console.error('[Booking] /admin-cancel error:', error);
    return res.status(500).json({ error: 'Errore durante l\'annullamento amministrativo' });
  }
});

router.patch('/admin-restore/:id', requireAdminAccess, async (req, res) => {
  try {
    const id = normalizeText(req.params.id);
    if (!id) return res.status(400).json({ error: 'ID prenotazione richiesto' });

    const booking = await Booking.findById(id);
    if (!booking) return res.status(404).json({ error: 'Prenotazione non trovata' });

    if (Number(booking.refundedAmount || 0) >= Number(booking.amount || 0) && Number(booking.amount || 0) > 0) {
      return res.status(409).json({ error: 'Prenotazione rimborsata totalmente: impossibile riattivarla' });
    }

    await assertBookingAvailability({
      date: booking.date,
      tableNumbers: booking.tableNumbers,
      chairs: booking.chairs,
      umbrellas: booking.umbrellas,
      excludeId: booking._id
    });

    booking.status = 'active';
    booking.notes = buildAdminRestoreNotes(booking.notes);
    await booking.save();
    const stripeSync = await syncStripeBookingMetadata(booking, 'restored');

    return res.json({
      success: true,
      stripeSync,
      item: serializeBooking(booking)
    });
  } catch (error) {
    console.error('[Booking] /admin-restore error:', error);
    return res.status(error.statusCode || 500).json({ error: error.message || 'Errore durante la riattivazione della prenotazione' });
  }
});

router.post('/admin-refund/:id', requireAdminAccess, async (req, res) => {
  try {
    const id = normalizeText(req.params.id);
    if (!id) return res.status(400).json({ error: 'ID prenotazione richiesto' });
    if (!stripeClient) return res.status(503).json({ error: 'Stripe non configurato sul backend' });

    const booking = await Booking.findById(id);
    if (!booking) return res.status(404).json({ error: 'Prenotazione non trovata' });
    if (!booking.paymentId) return res.status(400).json({ error: 'La prenotazione non e associata a un pagamento Stripe' });

    const session = await resolveStripeSessionForBooking(booking);
    if (!session) return res.status(502).json({ error: 'Impossibile recuperare la sessione Stripe della prenotazione' });

    const paymentIntentId = normalizeText(session?.payment_intent?.id || session?.payment_intent || booking.paymentIntentId);
    const chargeId = normalizeText(session?.payment_intent?.latest_charge?.id || '');
    const totalAmount = Number(session.amount_total || booking.amount || 0);
    const currentRefunded = Math.max(Number(booking.refundedAmount || 0), getRefundedAmountFromSession(session));
    const refundableAmount = Math.max(totalAmount - currentRefunded, 0);
    if (refundableAmount <= 0) {
      return res.status(409).json({ error: 'Questa prenotazione risulta gia rimborsata completamente' });
    }

    const requestedAmount = toNonNegativeInt(req.body?.amount, refundableAmount);
    const refundAmount = requestedAmount > 0 ? requestedAmount : refundableAmount;
    if (refundAmount > refundableAmount) {
      return res.status(409).json({ error: `Importo rimborsabile massimo: ${refundableAmount} centesimi` });
    }

    const cancelBooking = req.body?.cancelBooking !== false;
    const reason = normalizeText(req.body?.reason);
    const refundPayload = {
      amount: refundAmount,
      metadata: {
        booking_id: booking.bookingId || booking._id.toString(),
        booking_admin_action: cancelBooking ? 'refund_and_cancel' : 'partial_refund',
        booking_reason: reason
      }
    };
    if (paymentIntentId) refundPayload.payment_intent = paymentIntentId;
    else if (chargeId) refundPayload.charge = chargeId;
    else return res.status(502).json({ error: 'Impossibile risalire al pagamento Stripe da rimborsare' });

    const refund = await stripeClient.refunds.create(refundPayload);
    const nextRefundedAmount = currentRefunded + refundAmount;
    booking.paymentIntentId = paymentIntentId || booking.paymentIntentId;
    booking.refundedAmount = Math.min(nextRefundedAmount, totalAmount);
    booking.paymentStatus = booking.refundedAmount >= totalAmount ? FULL_REFUND_STATUS : PARTIAL_REFUND_STATUS;
    booking.lastRefundId = refund.id || '';
    booking.lastRefundAt = new Date();
    if (cancelBooking || booking.paymentStatus === FULL_REFUND_STATUS) {
      booking.status = 'cancelled';
      booking.notes = buildAdminCancellationNotes(booking.notes);
    }
    booking.notes = buildRefundNotes(booking.notes, refundAmount, reason);
    await booking.save();
    const stripeSync = await syncStripeBookingMetadata(booking, 'refunded');

    return res.json({
      success: true,
      refund: {
        id: refund.id,
        amount: refund.amount,
        status: refund.status || 'pending'
      },
      stripeSync,
      item: serializeBooking(booking)
    });
  } catch (error) {
    console.error('[Booking] /admin-refund error:', error);
    return res.status(error.statusCode || 500).json({ error: error.message || 'Errore durante il rimborso Stripe' });
  }
});

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
      items: bookings.map((booking) => serializeBooking(booking))
    });
  } catch (error) {
    console.error('[Booking] /lista error:', error);
    return res.status(500).json({ error: 'Errore nel recupero prenotazioni' });
  }
});

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
          refundedAmount: { $sum: '$refundedAmount' },
          bookings: { $sum: 1 }
        }
      }
    ]);

    const stats = agg || {
      tablesBooked: 0,
      chairsBooked: 0,
      umbrellasBooked: 0,
      totalAmount: 0,
      refundedAmount: 0,
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
      totalAmount: stats.totalAmount,
      refundedAmount: stats.refundedAmount,
      netAmount: Math.max(Number(stats.totalAmount || 0) - Number(stats.refundedAmount || 0), 0)
    });
  } catch (error) {
    console.error('[Booking] /stats error:', error);
    return res.status(500).json({ error: 'Errore nel recupero statistiche' });
  }
});

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
        const incomingTableNumbers = normalizeTableNumbers(bookingData.tableNumbers || []);
        const existingBooking = await Booking.findOne({ paymentId: session.id })
          .select('_id customerConfirmationSentAt customerConfirmationSendingAt')
          .lean();

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
          notes: buildBookingNotes(bookingData.notes || '', incomingTableNumbers),
          tables: incomingTableNumbers.length > 0 ? incomingTableNumbers.length : Number(bookingData.tables || 0),
          tableNumbers: incomingTableNumbers,
          chairs: Number(bookingData.chairs || 0),
          umbrellas: Number(bookingData.umbrellas || 0),
          amount: Number(session.amount_total || 0),
          refundedAmount: getRefundedAmountFromSession(session),
          paymentId: session.id || '',
          paymentIntentId: normalizeText(session?.payment_intent?.id || session?.payment_intent),
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

        if (bookingStatus === 'active' && !existingBooking) {
          try {
            await mailer.sendOwnerNotification({ booking: bookingDoc, amount: payload.amount, notifyCustomer: false });
            await sendCustomerConfirmationOnce(bookingDoc, payload.amount);
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

  if (month === 5 && day >= 24 && day <= 31) return true;

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