// Backend/models/Payment.js
const mongoose = require('mongoose');

const PaymentSchema = new mongoose.Schema({
  username: { type: String },
  accountNumber: { type: String },
  amount: { type: Number, required: true },
  currency: { type: String, required: true },
  provider: { type: String, required: true },
  accountInfo: { type: String, required: true },
  swiftCode: { type: String, required: true },
  senderEmail: { type: String, required: true },
  receiverEmail: { type: String, required: true },
  verified: { type: Boolean, default: false },
  reason: { type: String,required: true },
  createdAt: { type: Date, default: Date.now },
    submitted: { type: Boolean, default: false }
});


module.exports = mongoose.model('Payment', PaymentSchema);
