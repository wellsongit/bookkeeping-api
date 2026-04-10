const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const sqlite3 = require('sqlite3').verbose();
require('dotenv').config();

const app = express();
app.use(helmet());
app.use(cors());
app.use(express.json());

// SQLite Database (single file!)
const db = new sqlite3.Database('bookkeeping.db');
console.log('✅ SQLite database ready!');

// Create tables
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE,
    password TEXT,
    name TEXT
  )`);
  
  db.run(`CREATE TABLE IF NOT EXISTS accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    name TEXT,
    type TEXT,
    balance REAL DEFAULT 0,
    FOREIGN KEY(user_id) REFERENCES users(id)
  )`);
  
  db.run(`CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    account_id INTEGER,
    type TEXT,
    category TEXT,
    amount REAL,
    description TEXT,
    date DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id),
    FOREIGN KEY(account_id) REFERENCES accounts(id)
  )`);
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'SQLite Bookkeeping API LIVE! 🎉',
    database: 'SQLite (file-based)'
  });
});

// Auth Routes
app.post('/api/auth/register', async (req, res) => {
  const { email, password, name } = req.body;
  
  db.get('SELECT id FROM users WHERE email = ?', [email], async (err, user) => {
    if (user) {
      return res.status(400).json({ error: 'User already exists' });
    }
    
    const hashedPassword = await bcrypt.hash(password, 12);
    
    db.run('INSERT INTO users (email, password, name) VALUES (?, ?, ?)', 
      [email, hashedPassword, name], function(err) {
        if (err) return res.status(500).json({ error: 'Database error' });
        
        const token = jwt.sign({ userId: this.lastID }, process.env.JWT_SECRET, { expiresIn: '7d' });
        res.json({
          token,
          user: { id: this.lastID, email, name }
        });
      });
  });
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  
  db.get('SELECT * FROM users WHERE email = ?', [email], async (err, user) => {
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }
    
    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({
      token,
      user: { id: user.id, email: user.email, name: user.name }
    });
  });
});

// Middleware to verify JWT
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) return res.status(401).json({ error: 'Access token required' });
  
  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });
    req.user = user;
    next();
  });
};

// Accounts Routes
app.get('/api/accounts', authenticateToken, (req, res) => {
  db.all('SELECT * FROM accounts WHERE user_id = ?', [req.user.userId], (err, accounts) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    res.json(accounts);
  });
});

app.post('/api/accounts', authenticateToken, (req, res) => {
  const { name, type, balance = 0 } = req.body;
  
  db.run('INSERT INTO accounts (user_id, name, type, balance) VALUES (?, ?, ?, ?)',
    [req.user.userId, name, type, balance], function(err) {
      if (err) return res.status(500).json({ error: 'Database error' });
      res.status(201).json({ id: this.lastID, name, type, balance });
    });
});

// Transactions Routes
app.get('/api/transactions', authenticateToken, (req, res) => {
  db.all(`
    SELECT t.*, a.name as account_name 
    FROM transactions t 
    JOIN accounts a ON t.account_id = a.id 
    WHERE t.user_id = ? 
    ORDER BY t.date DESC
  `, [req.user.userId], (err, transactions) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    res.json(transactions);
  });
});

app.post('/api/transactions', authenticateToken, (req, res) => {
  const { accountId, type, category, amount, description } = req.body;
  
  db.run(`
    INSERT INTO transactions (user_id, account_id, type, category, amount, description) 
    VALUES (?, ?, ?, ?, ?, ?)
  `, [req.user.userId, accountId, type, category, amount, description], function(err) {
    if (err) return res.status(500).json({ error: 'Database error' });
    res.status(201).json({ id: this.lastID, ...req.body });
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 SQLite API: http://localhost:${PORT}/api/health`);
});