const express = require('express');
const router = express.Router();
const db = require('../config/db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
require('dotenv').config();

// Middleware to verify a JWT and attach the decoded user to the request
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) {
    return res.status(401).json({ message: 'No token provided.' });
  }
  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ message: 'Invalid token.' });
    }
    req.user = user;
    next();
  });
}

// Utility: Promisify db.query for async/await
const query = (sql, params) => new Promise((resolve, reject) => {
  db.query(sql, params, (err, results) => {
    if (err) reject(err);
    else resolve(results);
  });
});

// =================== LOGIN ===================
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required.' });
    }

    const results = await query(
      'SELECT u.*, d.dashboard_id FROM users u LEFT JOIN dashboards d ON u.user_id = d.user_id WHERE u.email = ?',
      [email]
    );
    if (results.length === 0) {
      return res.status(401).json({ message: 'Invalid credentials.' });
    }

    const user = results[0];
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ message: 'Invalid credentials.' });
    }

    const token = jwt.sign(
      { user_id: user.user_id },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    res.json({
      token,
      user: {
        user_id: user.user_id,
        name: user.name,
        email: user.email,
        dashboard_id: user.dashboard_id
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: 'Server error', error: err });
  }
});

// =================== REGISTER ===================
router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'All fields are required.' });
    }

    // Check if user already exists
    const existing = await query('SELECT user_id FROM users WHERE email = ?', [email]);
    if (existing.length > 0) {
      return res.status(409).json({ message: 'Email already in use.' });
    }

    // Hash the password
    const password_hash = await bcrypt.hash(password, 10);

    // Insert new user
    const result = await query(
      'INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)',
      [name, email, password_hash]
    );

    // Create a dashboard for this user
    await query('INSERT INTO dashboards (user_id) VALUES (?)', [result.insertId]);

    res.status(201).json({ message: 'Registration successful! You can now log in.' });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ message: 'Server error', error: err });
  }
});

// =================== LOGOUT ===================
// For JWT-based auth, logout is handled on the client by discarding the token.
// This endpoint exists to allow the client to signal a logout and to maintain
// symmetry with login. The token is validated to ensure only authenticated users
// can hit this route.
router.post('/logout', authenticateToken, (req, res) => {
  res.json({ message: 'Logged out successfully.' });
});

module.exports = router;
