const express = require('express');
const router = express.Router();
const db = require('../config/db');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
require('dotenv').config();

// Utility helper to use async/await with db queries
function query(sql, params) {
  return new Promise((resolve, reject) => {
    db.query(sql, params, (err, results) => {
      if (err) reject(err);
      else resolve(results);
    });
  });
}

// Middleware to verify JWT
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'No token provided.' });
  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ message: 'Invalid token.' });
    req.user = user;
    next();
  });
}

// Get profile of authenticated user
router.get('/', authenticateToken, (req, res) => {
  db.query('SELECT user_id, name, email, created_at FROM users WHERE user_id = ?', [req.user.user_id], (err, results) => {
    if (err) return res.status(500).json({ message: 'Database error', error: err });
    if (results.length === 0) return res.status(404).json({ message: 'User not found.' });
    res.json(results[0]);
  });
});

// Update basic profile information for the authenticated user
router.put('/', authenticateToken, async (req, res) => {
  const { name, email } = req.body;
  if (!name && !email) {
    return res.status(400).json({ message: 'No update fields provided.' });
  }
  try {
    const fields = [];
    const params = [];
    if (name) {
      fields.push('name = ?');
      params.push(name);
    }
    if (email) {
      fields.push('email = ?');
      params.push(email);
    }
    params.push(req.user.user_id);
    await query(`UPDATE users SET ${fields.join(', ')} WHERE user_id = ?`, params);
    res.json({ message: 'Profile updated successfully.' });
  } catch (err) {
    console.error('Profile update error:', err);
    res.status(500).json({ message: 'Server error', error: err });
  }
});

// Change password for the authenticated user
router.put('/password', authenticateToken, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ message: 'Current and new passwords are required.' });
  }
  try {
    const results = await query('SELECT password_hash FROM users WHERE user_id = ?', [req.user.user_id]);
    if (results.length === 0) {
      return res.status(404).json({ message: 'User not found.' });
    }
    const user = results[0];
    const match = await bcrypt.compare(currentPassword, user.password_hash);
    if (!match) {
      return res.status(401).json({ message: 'Current password is incorrect.' });
    }
    const newHash = await bcrypt.hash(newPassword, 10);
    await query('UPDATE users SET password_hash = ? WHERE user_id = ?', [newHash, req.user.user_id]);
    res.json({ message: 'Password changed successfully.' });
  } catch (err) {
    console.error('Change password error:', err);
    res.status(500).json({ message: 'Server error', error: err });
  }
});

module.exports = router;

