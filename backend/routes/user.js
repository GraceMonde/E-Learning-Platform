const express = require('express');
const router = express.Router();
const db = require('../config/db');
const bcrypt = require('bcrypt');

// Register a new user
router.post('/register', async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ message: 'All fields are required.' });
  }
  try {
    const hash = await bcrypt.hash(password, 10);
    db.query('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)', [name, email, hash], (err, result) => {
      if (err) {
        if (err.code === 'ER_DUP_ENTRY') {
          return res.status(409).json({ message: 'Email already exists.' });
        }
        return res.status(500).json({ message: 'Database error', error: err });
      }
      db.query('INSERT INTO dashboards (user_id) VALUES (?)', [result.insertId]);
      res.status(201).json({ message: 'User registered successfully.' });
    });
  } catch (err) {
    res.status(500).json({ message: 'Error hashing password', error: err });
  }
});

// Get all users (for demo)
router.get('/', (req, res) => {
  db.query('SELECT user_id, name, email, created_at FROM users', (err, results) => {
    if (err) return res.status(500).json({ message: 'Database error', error: err });
    res.json(results);
  });
});

module.exports = router;

