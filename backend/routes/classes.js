const express = require('express');
const router = express.Router();
const db = require('../config/db');
const jwt = require('jsonwebtoken');
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

// Generate a simple invite code
async function generateInviteCode() {
  let code;
  let exists = true;
  while (exists) {
    code = Math.random().toString(36).substring(2, 8).toUpperCase();
    const check = await query('SELECT class_id FROM classes WHERE invite_code = ?', [code]);
    exists = check.length > 0;
  }
  return code;
}

// Create a class
router.post('/', authenticateToken, async (req, res) => {
  const { title, description } = req.body;
  if (!title || !description) {
    return res.status(400).json({ message: 'Title and description are required.' });
  }
  try {
    const inviteCode = await generateInviteCode();
    const result = await query(
      'INSERT INTO classes (title, description, invite_code, instructor_id) VALUES (?, ?, ?, ?)',
      [title, description, inviteCode, req.user.user_id]
    );
    res.status(201).json({
      class_id: result.insertId,
      title,
      description,
      invite_code: inviteCode
    });
  } catch (err) {
    console.error('Create class error:', err);
    res.status(500).json({ message: 'Server error', error: err });
  }
});

// Edit class details
router.put('/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { title, description } = req.body;
  if (!title && !description) {
    return res.status(400).json({ message: 'No update fields provided.' });
  }
  try {
    const fields = [];
    const params = [];
    if (title) {
      fields.push('title = ?');
      params.push(title);
    }
    if (description) {
      fields.push('description = ?');
      params.push(description);
    }
    params.push(id, req.user.user_id);
    const result = await query(
      `UPDATE classes SET ${fields.join(', ')} WHERE class_id = ? AND instructor_id = ?`,
      params
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Class not found or unauthorized.' });
    }
    res.json({ message: 'Class updated successfully.' });
  } catch (err) {
    console.error('Edit class error:', err);
    res.status(500).json({ message: 'Server error', error: err });
  }
});

// Delete class
router.delete('/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    const result = await query(
      'DELETE FROM classes WHERE class_id = ? AND instructor_id = ?',
      [id, req.user.user_id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Class not found or unauthorized.' });
    }
    res.json({ message: 'Class deleted successfully.' });
  } catch (err) {
    console.error('Delete class error:', err);
    res.status(500).json({ message: 'Server error', error: err });
  }
});

// Join class via invite code
router.post('/join', authenticateToken, async (req, res) => {
  const { invite_code } = req.body;
  if (!invite_code) {
    return res.status(400).json({ message: 'Invite code is required.' });
  }
  try {
    const classes = await query('SELECT class_id FROM classes WHERE invite_code = ?', [invite_code]);
    if (classes.length === 0) {
      return res.status(404).json({ message: 'Class not found.' });
    }
    const classId = classes[0].class_id;
    const existing = await query(
      'SELECT enrollment_id FROM enrollments WHERE class_id = ? AND student_id = ?',
      [classId, req.user.user_id]
    );
    if (existing.length > 0) {
      return res.status(409).json({ message: 'Already requested to join this class.' });
    }
    await query('INSERT INTO enrollments (class_id, student_id) VALUES (?, ?)', [classId, req.user.user_id]);
    res.status(201).json({ message: 'Enrollment request submitted.' });
  } catch (err) {
    console.error('Join class error:', err);
    res.status(500).json({ message: 'Server error', error: err });
  }
});

// Approve or reject enrollment
router.put('/:classId/enrollments/:enrollmentId', authenticateToken, async (req, res) => {
  const { classId, enrollmentId } = req.params;
  const { status } = req.body;
  if (!['approved', 'rejected'].includes(status)) {
    return res.status(400).json({ message: 'Status must be approved or rejected.' });
  }
  try {
    const classes = await query('SELECT class_id FROM classes WHERE class_id = ? AND instructor_id = ?', [classId, req.user.user_id]);
    if (classes.length === 0) {
      return res.status(403).json({ message: 'Not authorized to manage this class.' });
    }
    const result = await query(
      'UPDATE enrollments SET status = ? WHERE enrollment_id = ? AND class_id = ?',
      [status, enrollmentId, classId]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Enrollment not found.' });
    }
    res.json({ message: `Enrollment ${status}.` });
  } catch (err) {
    console.error('Update enrollment error:', err);
    res.status(500).json({ message: 'Server error', error: err });
  }
});

module.exports = router;
