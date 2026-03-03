// Mailer service (CommonJS)
module.exports = {
  // Invia email di conferma prenotazione (stub, da integrare con EmailJS o altro)
  async sendBookingConfirmation({ to, booking, amount }) {
    // Qui puoi integrare EmailJS, nodemailer, ecc.
    console.log(`Email di conferma inviata a ${to} per prenotazione:`, booking, 'Importo:', amount);
    return true;
  }
};