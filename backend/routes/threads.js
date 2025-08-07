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

async function isClassMember(classId, userId) {
  const rows = await query('SELECT instructor_id FROM classes WHERE class_id = ?', [classId]);
  if (rows.length === 0) return false;
  if (rows[0].instructor_id === userId) return true;
  const enrolled = await query("SELECT enrollment_id FROM enrollments WHERE class_id = ? AND student_id = ? AND status = 'approved'", [classId, userId]);
  return enrolled.length > 0;
}

// Fetch threads for a class
router.get('/class/:classId', authenticateToken, async (req, res) => {
  const { classId } = req.params;
  try {
    const threads = await query(
      `SELECT t.thread_id, t.title, t.content, t.created_by, t.created_at, u.name
         FROM threads t
         JOIN users u ON t.created_by = u.user_id
        WHERE t.class_id = ?
        ORDER BY t.created_at DESC`,
      [classId]
    );
    res.json(threads);
  } catch (err) {
    console.error('Fetch threads error:', err);
    res.status(500).json({ message: 'Server error', error: err });
  }
});

// Start a thread
router.post('/class/:classId', authenticateToken, async (req, res) => {
  const { classId } = req.params;
  const { title, content } = req.body;
  if (!title || !content) {
    return res.status(400).json({ message: 'Title and content are required.' });
  }
  try {
    const member = await isClassMember(classId, req.user.user_id);
    if (!member) {
      return res.status(403).json({ message: 'Not authorized to create thread in this class.' });
    }
    const result = await query('INSERT INTO threads (class_id, created_by, title, content) VALUES (?, ?, ?, ?)', [classId, req.user.user_id, title, content]);

    // Notify instructor if student started thread
    const cls = await query('SELECT instructor_id FROM classes WHERE class_id = ?', [classId]);
    if (cls.length > 0 && cls[0].instructor_id !== req.user.user_id) {
      await query('INSERT INTO notifications (user_id, message) VALUES (?, ?)', [cls[0].instructor_id, `New discussion thread in class ${classId}`]);
    }

    res.status(201).json({ thread_id: result.insertId });
  } catch (err) {
    console.error('Create thread error:', err);
    res.status(500).json({ message: 'Server error', error: err });
  }
});

// Get comments for a thread
router.get('/:threadId/comments', authenticateToken, async (req, res) => {
  const { threadId } = req.params;
  try {
    const comments = await query(
      `SELECT c.comment_id, c.content, c.posted_by, c.posted_at, u.name
         FROM comments c
         JOIN users u ON c.posted_by = u.user_id
        WHERE c.thread_id = ?
        ORDER BY c.posted_at ASC`,
      [threadId]
    );
    res.json(comments);
  } catch (err) {
    console.error('Fetch comments error:', err);
    res.status(500).json({ message: 'Server error', error: err });
  }
});

// Post comment on thread
router.post('/:threadId/comments', authenticateToken, async (req, res) => {
  const { threadId } = req.params;
  const { content } = req.body;
  if (!content) {
    return res.status(400).json({ message: 'Content is required.' });
  }
  try {
    const threads = await query('SELECT class_id, created_by FROM threads WHERE thread_id = ?', [threadId]);
    if (threads.length === 0) {
      return res.status(404).json({ message: 'Thread not found.' });
    }
    const classId = threads[0].class_id;
    const member = await isClassMember(classId, req.user.user_id);
    if (!member) {
      return res.status(403).json({ message: 'Not authorized to comment on this thread.' });
    }
    const result = await query('INSERT INTO comments (thread_id, posted_by, content) VALUES (?, ?, ?)', [threadId, req.user.user_id, content]);

    // Notify thread creator
    if (threads[0].created_by !== req.user.user_id) {
      await query('INSERT INTO notifications (user_id, message) VALUES (?, ?)', [threads[0].created_by, 'New comment on your thread']);
    }

    res.status(201).json({ comment_id: result.insertId });
  } catch (err) {
    console.error('Post comment error:', err);
    res.status(500).json({ message: 'Server error', error: err });
  }
});

module.exports = router;
