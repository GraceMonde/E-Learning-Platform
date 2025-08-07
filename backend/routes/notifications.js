const express = require('express');
const router = express.Router();
const db = require('../config/db');
const jwt = require('jsonwebtoken');
require('dotenv').config();

function query(sql, params) {
  return new Promise((resolve, reject) => {
    db.query(sql, params, (err, results) => {
      if (err) reject(err);
      else resolve(results);
    });
  });
}

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

// Get notifications for the user
router.get('/', authenticateToken, async (req, res) => {
  try {
    const notes = await query(
      `SELECT notification_id, message, is_read, created_at
         FROM notifications
        WHERE user_id = ?
        ORDER BY created_at DESC`,
      [req.user.user_id]
    );
    res.json(notes);
  } catch (err) {
    console.error('Fetch notifications error:', err);
    res.status(500).json({ message: 'Server error', error: err });
  }
});

// Mark notification as read
router.post('/:id/read', authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    await query('UPDATE notifications SET is_read = 1 WHERE notification_id = ? AND user_id = ?', [id, req.user.user_id]);
    res.json({ message: 'Notification marked as read.' });
  } catch (err) {
    console.error('Mark notification read error:', err);
    res.status(500).json({ message: 'Server error', error: err });
  }
});

module.exports = router;
