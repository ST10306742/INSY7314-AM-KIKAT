// Backend/routes/paymentRoutes.js
const express = require('express');
const router = express.Router();
const { authenticate, authorizeRoles } = require("../middleware/authMiddleware");
const Payment = require('../models/Payment');
const sendTransactionEmails = require('../services/emailService');

// XSS sanitization and regex whitelisting
const xss = require("xss");
const sanitize = (str) => (typeof str === "string" ? xss(str.trim()) : str);

// whitelist regex patterns
const whitelistPatterns = {
  username: /^[a-zA-Z0-9_ ]{3,30}$/, // letters, numbers, underscore, space
  accountNumber: /^[0-9]{6,20}$/, // digits only
  amount: /^[0-9]+(\.[0-9]{1,2})?$/, // allows 100 or 100.00
  currency: /^[A-Z]{3}$/, // 3-letter ISO currency (USD, ZAR, EUR)
  provider: /^[a-zA-Z0-9\s\-]{2,50}$/, // e.g., PayPal, FNB, etc.
  accountInfo: /^[a-zA-Z0-9\s,.'\-]{3,100}$/, // address/account name
  swiftCode: /^[A-Z0-9]{8,11}$/, // standard SWIFT/BIC code
  senderEmail: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, // basic email
  receiverEmail: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, // basic email
};

// test regex whitelist
function validateWhitelist(field, value) {
  const pattern = whitelistPatterns[field];
  return pattern ? pattern.test(value) : true;
}

// Payment Route
router.post('/', authenticate, authorizeRoles("user"), async (req, res) => {
  try {
    const {
      username,
      accountNumber,
      amount,
      currency,
      provider,
      accountInfo,
      swiftCode,
      senderEmail,
      receiverEmail,
    } = req.body;

    console.log('Received payment request:', req.body);

    // Sanitize all fields
    const sanitized = {
      username: sanitize(username),
      accountNumber: sanitize(accountNumber),
      amount: sanitize(amount),
      currency: sanitize(currency),
      provider: sanitize(provider),
      accountInfo: sanitize(accountInfo),
      swiftCode: sanitize(swiftCode),
      senderEmail: sanitize(senderEmail),
      receiverEmail: sanitize(receiverEmail),
    };

    
    if (
      ![
        sanitized.amount,
        sanitized.currency,
        sanitized.provider,
        sanitized.accountInfo,
        sanitized.swiftCode,
        sanitized.senderEmail,
        sanitized.receiverEmail,
      ].every(Boolean)
    ) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    // Regex whitelist validation
    for (const [key, value] of Object.entries(sanitized)) {
      if (value && !validateWhitelist(key, value)) {
        return res.status(400).json({ message: `Invalid ${key} format` });
      }
    }

    
    const payment = new Payment({
      username: sanitized.username || 'Test User',
      accountNumber: sanitized.accountNumber || '12345678',
      amount: sanitized.amount,
      currency: sanitized.currency,
      provider: sanitized.provider,
      accountInfo: sanitized.accountInfo,
      swiftCode: sanitized.swiftCode,
      senderEmail: sanitized.senderEmail,
      receiverEmail: sanitized.receiverEmail,
      verified: false,
      reason: "New payment Unprocessed",
    });

    // Save to DB
    await payment.save();

    // Send test emails (logs only)
    await sendTransactionEmails(
      sanitized.senderEmail,
      sanitized.receiverEmail,
      `${sanitized.currency} ${sanitized.amount}`
    );

    res.status(200).json({
      message: 'Payment submited (TEST MODE). Emails logged to console.',
    });
  } catch (error) {
    console.error('Payment error:', error);
    res
      .status(500)
      .json({ message: 'Failed to process payment. (TEST MODE).' });
  }
});

module.exports = router;

//ChatGPT. (2025) ChatGPT — Whitelisting with regex. 
// Available at: https://chatgpt.com/share/68e9737f-31ac-800b-9c75-cab69c0eb737
//(Accessed: 10 October 2025).