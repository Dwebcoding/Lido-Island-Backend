// Booking model (ESM)
import mongoose from 'mongoose';

const bookingSchema = new mongoose.Schema({
  date: { type: String, required: true },
  tables: { type: Number, required: true },
  chairs: { type: Number, required: true },
  umbrellas: { type: Number, required: true },
  status: { type: String, default: 'active' }
});

const Booking = mongoose.models.Booking || mongoose.model('Booking', bookingSchema);
export default Booking;