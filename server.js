const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
require('dotenv').config();

const app = express();
app.use(helmet());
app.use(cors());
app.use(express.json());

// ✅ MongoDB connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });

/* ================= MODELS ================= */

const User = mongoose.model('User', new mongoose.Schema({
  email: { type: String, unique: true },
  password: String,
  name: String
}));

const Account = mongoose.model('Account', new mongoose.Schema({
  user_id: mongoose.Schema.Types.ObjectId,
  name: String,
  type: String,
  balance: { type: Number, default: 0 }
}));

const Transaction = mongoose.model('Transaction', new mongoose.Schema({
  user_id: mongoose.Schema.Types.ObjectId,
  account_id: mongoose.Schema.Types.ObjectId,
  type: String,
  category: String,
  amount: Number,
  description: String,
  date: { type: Date, default: Date.now }
}));

/* ================= ROUTES ================= */

// Health
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'API LIVE 🚀' });
});

// Register
app.post('/api/auth/register', async (req, res) => {
  const { email, password, name } = req.body;

  const existing = await User.findOne({ email });
  if (existing) return res.status(400).json({ error: 'User exists' });

  const hashed = await bcrypt.hash(password, 12);

  const user = await User.create({ email, password: hashed, name });

  const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });

  res.json({ token, user });
});

// Login
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email });
  if (!user || !(await bcrypt.compare(password, user.password))) {
    return res.status(400).json({ error: 'Invalid credentials' });
  }

  const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });

  res.json({ token, user });
});

// Auth middleware
const authenticateToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token' });

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });
    req.user = user;
    next();
  });
};

// Accounts
app.get('/api/accounts', authenticateToken, async (req, res) => {
  const data = await Account.find({ user_id: req.user.userId });
  res.json(data);
});

app.post('/api/accounts', authenticateToken, async (req, res) => {
  const { name, type, balance = 0 } = req.body;

  const account = await Account.create({
    user_id: req.user.userId,
    name,
    type,
    balance
  });

  res.status(201).json(account);
});

// Transactions
app.get('/api/transactions', authenticateToken, async (req, res) => {
  const data = await Transaction.find({ user_id: req.user.userId }).sort({ date: -1 });
  res.json(data);
});

app.post('/api/transactions', authenticateToken, async (req, res) => {
  const { accountId, type, category, amount, description } = req.body;

  const tx = await Transaction.create({
    user_id: req.user.userId,
    account_id: accountId,
    type,
    category,
    amount,
    description
  });

  res.status(201).json(tx);
});

/* ================= SERVER ================= */

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});