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

// Get announcements for a class
router.get('/class/:classId', authenticateToken, async (req, res) => {
  const { classId } = req.params;
  try {
    const rows = await query(
      `SELECT announcement_id, message, posted_by, posted_at
         FROM announcements
        WHERE class_id = ?
        ORDER BY posted_at DESC`,
      [classId]
    );
    res.json(rows);
  } catch (err) {
    console.error('Fetch announcements error:', err);
    res.status(500).json({ message: 'Server error', error: err });
  }
});

// Post announcement (instructor only)
router.post('/class/:classId', authenticateToken, async (req, res) => {
  const { classId } = req.params;
  const { message } = req.body;
  if (!message) {
    return res.status(400).json({ message: 'Message is required.' });
  }
  try {
    const rows = await query('SELECT instructor_id FROM classes WHERE class_id = ?', [classId]);
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Class not found.' });
    }
    if (rows[0].instructor_id !== req.user.user_id) {
      return res.status(403).json({ message: 'Not authorized to post announcement for this class.' });
    }
    const result = await query('INSERT INTO announcements (class_id, message, posted_by) VALUES (?, ?, ?)', [classId, message, req.user.user_id]);

    // Notify enrolled students
    const students = await query("SELECT student_id FROM enrollments WHERE class_id = ? AND status = 'approved'", [classId]);
    if (students.length > 0) {
      const values = [];
      const placeholders = students
        .filter(s => s.student_id !== req.user.user_id)
        .map(() => '(?, ?)');
      students
        .filter(s => s.student_id !== req.user.user_id)
        .forEach(s => {
          values.push(s.student_id, `New announcement in class ${classId}`);
        });
      if (values.length > 0) {
        await query(`INSERT INTO notifications (user_id, message) VALUES ${placeholders.join(', ')}`, values);
      }
    }

    res.status(201).json({ announcement_id: result.insertId });
  } catch (err) {
    console.error('Post announcement error:', err);
    res.status(500).json({ message: 'Server error', error: err });
  }
});

module.exports = router;
