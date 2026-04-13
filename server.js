const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const app = express();
app.use(helmet());
app.use(cors());
app.use(express.json());

// Data storage
const DATA_DIR = './data';
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);

const readDB = (file) => {
  try {
    return JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), 'utf8') || '[]');
  } catch {
    return [];
  }
};

const writeDB = (file, data) => {
  fs.writeFileSync(path.join(DATA_DIR, file), JSON.stringify(data, null, 2));
};

// Routes
app.get('/', (req, res) => {
  res.json({ 
    message: '🚀 Finance API LIVE!', 
    endpoints: ['/api/auth/register', '/api/auth/login', '/api/accounts', '/api/transactions'],
    storage: 'JSON Files ✅'
  });
});

app.get('/api/health', (req, res) => res.json({ status: 'OK', message: 'API LIVE 🚀' }));

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

// REGISTER
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;
    let users = readDB('users.json');
    
    if (users.find(u => u.email === email)) 
      return res.status(400).json({ error: 'User exists' });
    
    const hashed = await bcrypt.hash(password, 12);
    const user = { 
      id: Date.now().toString(), 
      email, 
      password: hashed, 
      name 
    };
    users.push(user);
    writeDB('users.json', users);
    
    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user.id, email, name } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// LOGIN
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const users = readDB('users.json');
    const user = users.find(u => u.email === email);
    
    if (!user || !(await bcrypt.compare(password, user.password))) 
      return res.status(400).json({ error: 'Invalid credentials' });
    
    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user.id, email: user.email, name: user.name } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ACCOUNTS
app.get('/api/accounts', authenticateToken, (req, res) => {
  const accounts = readDB('accounts.json').filter(a => a.user_id === req.user.userId);
  res.json(accounts);
});

app.post('/api/accounts', authenticateToken, (req, res) => {
  const accounts = readDB('accounts.json');
  const account = { 
    id: Date.now().toString(),
    user_id: req.user.userId,
    ...req.body 
  };
  accounts.push(account);
  writeDB('accounts.json', accounts);
  res.status(201).json(account);
});

// TRANSACTIONS
app.get('/api/transactions', authenticateToken, (req, res) => {
  const transactions = readDB('transactions.json').filter(t => t.user_id === req.user.userId);
  res.json(transactions);
});

app.post('/api/transactions', authenticateToken, (req, res) => {
  const transactions = readDB('transactions.json');
  const transaction = { 
    id: Date.now().toString(),
    user_id: req.user.userId,
    ...req.body 
  };
  transactions.push(transaction);
  writeDB('transactions.json', transactions);
  res.status(201).json(transaction);
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`✅ JSON storage - No database needed!`);
  console.log(`📱 Test: http://localhost:${PORT}/api/health`);
});