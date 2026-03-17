// Booking model (ESM)
import mongoose from 'mongoose';

const bookingSchema = new mongoose.Schema(
  {
    bookingId: { type: String, trim: true, index: true },
    date: { type: String, required: true, index: true },
    name: { type: String, trim: true, default: '' },
    email: { type: String, trim: true, lowercase: true, index: true, default: '' },
    phone: { type: String, trim: true, default: '' },
    notes: { type: String, trim: true, default: '' },
    tables: { type: Number, required: true, min: 0, default: 0 },
    tableNumbers: { type: [Number], default: [] },
    chairs: { type: Number, required: true, min: 0, default: 0 },
    umbrellas: { type: Number, required: true, min: 0, default: 0 },
    amount: { type: Number, default: 0 }, // cents
    paymentId: { type: String, trim: true, default: '' }, // Stripe checkout session id
    paymentIntentId: { type: String, trim: true, default: '' },
    paymentStatus: { type: String, trim: true, default: 'paid' },
    refundedAmount: { type: Number, min: 0, default: 0 },
    lastRefundId: { type: String, trim: true, default: '' },
    lastRefundAt: { type: Date, default: null },
    status: { type: String, trim: true, default: 'active', index: true },
    source: { type: String, trim: true, default: 'stripe_checkout' },
    paidAt: { type: Date, default: Date.now, index: true }
  },
  {
    timestamps: true
  }
);

const Booking = mongoose.models.Booking || mongoose.model('Booking', bookingSchema);
export default Booking;
