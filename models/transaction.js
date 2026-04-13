const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  accountId: { type: mongoose.Schema.Types.ObjectId, ref: 'Account', required: true },
  type: { type: String, enum: ['income', 'expense', 'transfer'], required: true },
  category: { type: String, required: true }, // "Salary", "Groceries", etc.
  amount: { type: Number, required: true },
  description: String,
  date: { type: Date, default: Date.now },
  reconciled: { type: Boolean, default: false }
});

module.exports = mongoose.model('Transaction', transactionSchema);