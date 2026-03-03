import mongoose from 'mongoose';
import Booking from './models/booking.js';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/lido';

async function main(){
  try{
    await mongoose.connect(MONGO_URI, { dbName: 'lido' });
    const doc = await Booking.findOne().sort({_id:-1}).lean().exec();
    if(!doc){
      console.log('No bookings found');
    } else {
      console.log(JSON.stringify(doc, null, 2));
    }
    await mongoose.disconnect();
  }catch(err){
    console.error('DB error:', err);
    process.exit(1);
  }
}

main();
