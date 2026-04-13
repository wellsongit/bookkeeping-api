const express = require('express');
const Account = require('./models/Account');
const auth = require('./middleware/auth');
const router = express.Router();

router.use(auth); // All routes require authentication

router.get('/', async (req, res) => {
  try {
    const accounts = await Account.find({ userId: req.user._id });
    res.json(accounts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const account = new Account({ ...req.body, userId: req.user._id });
    await account.save();
    res.status(201).json(account);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;