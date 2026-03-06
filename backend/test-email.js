// Test script per verificare l'invio delle email
import 'dotenv/config';
import mailer from './services/mailer.js';

const testBooking = {
  _id: 'TEST-' + Date.now(),
  name: 'Mario Rossi',
  email: 'info@isolalido.it', // Email di test - riceverai la conferma cliente qui
  phone: '+39 333 123 4567',
  date: '2026-06-15',
  notes: 'Test prenotazione - verifica invio email con numeri tavoli',
  tables: 3,
  tables_count: 3,
  tableNumbers: [5, 12, 23], // Numeri tavoli prenotati
  chairs: 2,
  chairs_count: 2,
  tables_price: 2400, // 3 tavoli × 800 centesimi
  chairs_price: 1000, // 2 sdraio × 500 centesimi
  amount: 3400 // totale in centesimi (34,00 €)
};

console.log('=== TEST INVIO EMAIL ===');
console.log('Configurazione SMTP:');
console.log('- Host:', process.env.SMTP_HOST);
console.log('- Port:', process.env.SMTP_PORT);
console.log('- User:', process.env.SMTP_USER);
console.log('- From:', process.env.FROM_EMAIL);
console.log('- Owner:', process.env.OWNER_EMAIL);
console.log('\nDati prenotazione test:');
console.log(JSON.stringify(testBooking, null, 2));
console.log('\n--- Invio email al proprietario e al cliente ---\n');

mailer.sendOwnerNotification({
  booking: testBooking,
  amount: testBooking.amount,
  notifyCustomer: true
})
  .then((result) => {
    if (result) {
      console.log('\n✅ Email inviate con successo!');
      console.log('Controlla:');
      console.log('1. Email proprietario:', process.env.OWNER_EMAIL);
      console.log('2. Email cliente:', testBooking.email);
    } else {
      console.log('\n❌ Errore durante l\'invio delle email');
    }
    process.exit(result ? 0 : 1);
  })
  .catch((err) => {
    console.error('\n❌ Errore:', err);
    process.exit(1);
  });
