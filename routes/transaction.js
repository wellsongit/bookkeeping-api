const express = require('express');
const Transaction = require('./models/Transaction');
const auth = require('./middleware/auth');
const router = express.Router();

router.use(auth);

router.get('/', async (req, res) => {
  try {
    const { startDate, endDate, accountId } = req.query;
    let filter = { userId: req.user._id };

    if (accountId) filter.accountId = accountId;
    if (startDate) filter.date = { ...filter.date, $gte: new Date(startDate) };
    if (endDate) filter.date = { ...filter.date, $lte: new Date(endDate) };

    const transactions = await Transaction.find(filter).sort({ date: -1 });
    res.json(transactions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const transaction = new Transaction({ ...req.body, userId: req.user._id });
    await transaction.save();
    res.status(201).json(transaction);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;