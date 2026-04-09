import Booking from '../models/booking.js';

const CUSTOMER_CONFIRMATION_LOCK_TIMEOUT_MS = 15 * 60 * 1000;

export function hasCustomerConfirmationBeenSent(booking) {
  return Boolean(booking?.customerConfirmationSentAt);
}

export async function acquireCustomerConfirmationLock(bookingId) {
  if (!bookingId) return false;

  const now = new Date();
  const staleLockThreshold = new Date(now.getTime() - CUSTOMER_CONFIRMATION_LOCK_TIMEOUT_MS);

  const result = await Booking.updateOne(
    {
      _id: bookingId,
      customerConfirmationSentAt: null,
      $or: [
        { customerConfirmationSendingAt: null },
        { customerConfirmationSendingAt: { $lt: staleLockThreshold } }
      ]
    },
    {
      $set: { customerConfirmationSendingAt: now }
    }
  );

  return result.modifiedCount === 1;
}

export async function markCustomerConfirmationSent(bookingId) {
  if (!bookingId) return;

  await Booking.updateOne(
    { _id: bookingId },
    {
      $set: {
        customerConfirmationSentAt: new Date()
      },
      $unset: {
        customerConfirmationSendingAt: ''
      }
    }
  );
}

export async function releaseCustomerConfirmationLock(bookingId) {
  if (!bookingId) return;

  await Booking.updateOne(
    { _id: bookingId },
    {
      $unset: {
        customerConfirmationSendingAt: ''
      }
    }
  );
}