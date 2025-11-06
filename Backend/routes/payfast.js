const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const nodemailer = require('nodemailer');
require('dotenv').config();

const PF_MERCHANT_ID = process.env.PF_MERCHANT_ID;
const PF_MERCHANT_KEY = process.env.PF_MERCHANT_KEY;
const PF_PASSPHRASE = process.env.PF_PASSPHRASE || '';
const PF_URL = 'https://sandbox.payfast.co.za/eng/process';

// Generate PayFast signature
function generateSignature(data) {
  const sortedKeys = Object.keys(data).sort();
  const queryString = sortedKeys
    .map((key) => `${key}=${encodeURIComponent(data[key]).replace(/%20/g, '+')}`)
    .join('&');

  const fullString = PF_PASSPHRASE
    ? `${queryString}&passphrase=${encodeURIComponent(PF_PASSPHRASE)}`
    : queryString;

  return crypto.createHash('md5').update(fullString).digest('hex');
}

// Create PayFast sandbox URL
router.post('/create', async (req, res) => {
  try {
    const { amount, item_name, buyer_email } = req.body;

    if (!amount || !item_name || !buyer_email) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const data = {
      merchant_id: PF_MERCHANT_ID,
      merchant_key: PF_MERCHANT_KEY,
      return_url: 'https://localhost:5173/payment-success',
      cancel_url: 'https://localhost:5173/payment-cancel',
      notify_url: 'https://localhost:5000/api/payfast/notify',
      amount: parseFloat(amount).toFixed(2),
      item_name,
      email_address: buyer_email,
      m_payment_id: 'TEST-' + Date.now(),
    };

    const signature = generateSignature(data);
    data.signature = signature;

    const pfUrl =
      PF_URL +
      '?' +
      Object.entries(data)
        .map(([key, val]) => `${key}=${encodeURIComponent(val)}`)
        .join('&');

    console.log('Generated PayFast URL:', pfUrl);

    return res.json({
      message: 'PayFast sandbox link generated successfully.',
      url: pfUrl,
    });
  } catch (err) {
    console.error('PayFast error:', err);

    try {
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
      });

      await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: process.env.EMAIL_USER,
        subject: 'Payment processing failed (PayFast)',
        text: `Error: ${err.message}`,
      });
      console.log('Error email sent');
    } catch (mailErr) {
      console.error('Email send error:', mailErr);
    }

    res.status(500).json({ message: 'Payment failed, email sent.' });
  }
});

module.exports = router;
