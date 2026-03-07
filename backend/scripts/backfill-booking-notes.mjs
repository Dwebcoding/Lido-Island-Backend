import mongoose from 'mongoose';
import Booking from '../models/booking.js';

const mongoUri = String(process.env.MONGO_URI || '').trim();

function buildBookingNotes(notes, tableNumbers) {
  const normalizedNotes = String(notes || '').trim();
  const normalizedTableNumbers = Array.isArray(tableNumbers)
    ? tableNumbers
      .map((n) => Number(n))
      .filter((n) => Number.isInteger(n) && n >= 1 && n <= 110)
      .sort((left, right) => left - right)
    : [];

  if (!normalizedTableNumbers.length) return normalizedNotes;

  const tablesLine = `Tavoli: ${normalizedTableNumbers.join(', ')}`;
  if (!normalizedNotes) return tablesLine;
  if (/tavoli\s*:/i.test(normalizedNotes)) return normalizedNotes;

  return `${normalizedNotes}\n${tablesLine}`;
}

async function main() {
  if (!mongoUri) {
    throw new Error('MONGO_URI mancante');
  }

  await mongoose.connect(mongoUri);

  const query = {
    'tableNumbers.0': { $exists: true },
    $or: [
      { notes: { $exists: false } },
      { notes: null },
      { notes: '' },
      { notes: { $not: /tavoli\s*:/i } }
    ]
  };

  const docs = await Booking.find(query)
    .select('_id bookingId notes tableNumbers')
    .lean();

  if (!docs.length) {
    console.log(JSON.stringify({ matched: 0, modified: 0, remaining: 0 }));
    return;
  }

  const operations = docs.map((doc) => ({
    updateOne: {
      filter: { _id: doc._id },
      update: {
        $set: {
          notes: buildBookingNotes(doc.notes, doc.tableNumbers)
        }
      }
    }
  }));

  const result = await Booking.bulkWrite(operations, { ordered: false });
  const remaining = await Booking.countDocuments(query);

  console.log(
    JSON.stringify({
      matched: docs.length,
      modified: result.modifiedCount || 0,
      remaining
    })
  );
}

try {
  await main();
} finally {
  await mongoose.disconnect().catch(() => {});
}