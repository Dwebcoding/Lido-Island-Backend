// Test script for email functionality
import mailer from './services/mailer.js';

async function testEmail() {
  console.log('Testing email functionality...');
  
  try {
    // Test owner notification
    const testBooking = {
      _id: 'test-booking-123',
      name: 'Test Customer',
      email: 'test@example.com',
      phone: '+393331234567',
      date: '2026-06-15',
      notes: 'Test booking for email functionality',
      tables: 2,
      chairs: 4,
      tables_price: 1600, // in cents
      chairs_price: 2000, // in cents
      amount: 3600 // total in cents
    };

    const result = await mailer.sendOwnerNotification({
      booking: testBooking,
      amount: 3600,
      notifyCustomer: true
    });

    console.log('Email test result:', result ? 'SUCCESS' : 'FAILED');
    
    if (result) {
      console.log('✅ Email functionality is working correctly');
    } else {
      console.log('❌ Email functionality failed');
    }
  } catch (error) {
    console.error('❌ Email test failed with error:', error.message);
  }
}

testEmail();