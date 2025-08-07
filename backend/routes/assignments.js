const express = require('express');
const router = express.Router();
const db = require('../config/db');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Directory for assignment submissions
const submissionDir = path.join(__dirname, '../uploads/submissions');
if (!fs.existsSync(submissionDir)) {
  fs.mkdirSync(submissionDir, { recursive: true });
}

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

// Fetch assignments for a class and indicate if requester is instructor
router.get('/class/:classId', authenticateToken, async (req, res) => {
  const { classId } = req.params;
  try {
    const classes = await query('SELECT instructor_id FROM classes WHERE class_id = ?', [classId]);
    if (classes.length === 0) {
      return res.status(404).json({ message: 'Class not found.' });
    }
    const isInstructor = classes[0].instructor_id === req.user.user_id;
    if (!isInstructor) {
      const enrolled = await query(
        "SELECT enrollment_id FROM enrollments WHERE class_id = ? AND student_id = ? AND status = 'approved'",
        [classId, req.user.user_id]
      );
      if (enrolled.length === 0) {
        return res.status(403).json({ message: 'Not authorized to view assignments for this class.' });
      }
    }

    const assignments = await query(
      `SELECT a.assignment_id, a.title, a.description, a.due_date,
              s.submission_id, g.score, g.feedback
         FROM assignments a
         LEFT JOIN submissions s ON a.assignment_id = s.assignment_id AND s.student_id = ?
         LEFT JOIN grades g ON s.submission_id = g.submission_id
        WHERE a.class_id = ?`,
      [req.user.user_id, classId]
    );

    res.json({ is_instructor: isInstructor, assignments });
  } catch (err) {
    console.error('Fetch assignments error:', err);
    res.status(500).json({ message: 'Server error', error: err });
  }
});

// Create assignment
router.post('/class/:classId', authenticateToken, async (req, res) => {
  const { classId } = req.params;
  const { title, description, due_date } = req.body;
  if (!title) {
    return res.status(400).json({ message: 'Title is required.' });
  }
  try {
    const classes = await query('SELECT instructor_id FROM classes WHERE class_id = ?', [classId]);
    if (classes.length === 0 || classes[0].instructor_id !== req.user.user_id) {
      return res.status(403).json({ message: 'Not authorized to create assignment for this class.' });
    }
    const result = await query(
      'INSERT INTO assignments (class_id, title, description, due_date) VALUES (?, ?, ?, ?)',
      [classId, title, description, due_date]
    );
    res.status(201).json({ assignment_id: result.insertId });
  } catch (err) {
    console.error('Create assignment error:', err);
    res.status(500).json({ message: 'Server error', error: err });
  }
});

// Edit assignment details
router.put('/:assignmentId', authenticateToken, async (req, res) => {
  const { assignmentId } = req.params;
  const { title, description, due_date } = req.body;
  try {
    const rows = await query(
      `SELECT a.assignment_id, c.instructor_id
         FROM assignments a
         JOIN classes c ON a.class_id = c.class_id
        WHERE a.assignment_id = ?`,
      [assignmentId]
    );
    if (rows.length === 0 || rows[0].instructor_id !== req.user.user_id) {
      return res.status(403).json({ message: 'Not authorized to edit this assignment.' });
    }
    const fields = [];
    const params = [];
    if (title) { fields.push('title = ?'); params.push(title); }
    if (description) { fields.push('description = ?'); params.push(description); }
    if (due_date) { fields.push('due_date = ?'); params.push(due_date); }
    if (fields.length === 0) {
      return res.status(400).json({ message: 'No update fields provided.' });
    }
    params.push(assignmentId);
    await query(`UPDATE assignments SET ${fields.join(', ')} WHERE assignment_id = ?`, params);
    res.json({ message: 'Assignment updated successfully.' });
  } catch (err) {
    console.error('Edit assignment error:', err);
    res.status(500).json({ message: 'Server error', error: err });
  }
});

// Submit assignment
router.post('/:assignmentId/submit', authenticateToken, async (req, res) => {
  const { assignmentId } = req.params;
  const { fileName, fileData } = req.body;
  if (!fileName || !fileData) {
    return res.status(400).json({ message: 'File is required.' });
  }
  try {
    const check = await query('SELECT assignment_id FROM assignments WHERE assignment_id = ?', [assignmentId]);
    if (check.length === 0) {
      return res.status(404).json({ message: 'Assignment not found.' });
    }
    const buffer = Buffer.from(fileData, 'base64');
    const userDir = path.join(submissionDir, String(req.user.user_id));
    if (!fs.existsSync(userDir)) {
      fs.mkdirSync(userDir, { recursive: true });
    }
    const storedName = `${Date.now()}-${fileName}`;
    const filePath = path.join(userDir, storedName);
    fs.writeFileSync(filePath, buffer);
    const fileUrl = `/uploads/submissions/${req.user.user_id}/${storedName}`;
    const result = await query(
      'INSERT INTO submissions (assignment_id, student_id, file_url) VALUES (?, ?, ?)',
      [assignmentId, req.user.user_id, fileUrl]
    );
    res.status(201).json({ submission_id: result.insertId, file_url: fileUrl });
  } catch (err) {
    console.error('Submit assignment error:', err);
    res.status(500).json({ message: 'Server error', error: err });
  }
});

// View submitted assignments (instructor)
router.get('/:assignmentId/submissions', authenticateToken, async (req, res) => {
  const { assignmentId } = req.params;
  try {
    const rows = await query(
      `SELECT c.instructor_id
         FROM assignments a
         JOIN classes c ON a.class_id = c.class_id
        WHERE a.assignment_id = ?`,
      [assignmentId]
    );
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Assignment not found.' });
    }
    if (rows[0].instructor_id !== req.user.user_id) {
      return res.status(403).json({ message: 'Not authorized to view submissions.' });
    }
    const submissions = await query(
      `SELECT s.submission_id, s.file_url, s.submitted_at, u.name, g.score, g.feedback
         FROM submissions s
         JOIN users u ON s.student_id = u.user_id
         LEFT JOIN grades g ON s.submission_id = g.submission_id
        WHERE s.assignment_id = ?`,
      [assignmentId]
    );
    res.json(submissions);
  } catch (err) {
    console.error('Fetch submissions error:', err);
    res.status(500).json({ message: 'Server error', error: err });
  }
});

// Grade assignment submission
router.post('/submissions/:submissionId/grade', authenticateToken, async (req, res) => {
  const { submissionId } = req.params;
  const { score, feedback } = req.body;
  try {
    const rows = await query(
      `SELECT s.submission_id, c.instructor_id
         FROM submissions s
         JOIN assignments a ON s.assignment_id = a.assignment_id
         JOIN classes c ON a.class_id = c.class_id
        WHERE s.submission_id = ?`,
      [submissionId]
    );
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Submission not found.' });
    }
    if (rows[0].instructor_id !== req.user.user_id) {
      return res.status(403).json({ message: 'Not authorized to grade this submission.' });
    }
    const existing = await query('SELECT grade_id FROM grades WHERE submission_id = ?', [submissionId]);
    if (existing.length > 0) {
      await query(
        'UPDATE grades SET score = ?, feedback = ?, graded_by = ?, graded_at = NOW() WHERE grade_id = ?',
        [score, feedback, req.user.user_id, existing[0].grade_id]
      );
    } else {
      await query(
        'INSERT INTO grades (submission_id, score, feedback, graded_by) VALUES (?, ?, ?, ?)',
        [submissionId, score, feedback, req.user.user_id]
      );
    }
    res.json({ message: 'Grade saved.' });
  } catch (err) {
    console.error('Grade submission error:', err);
    res.status(500).json({ message: 'Server error', error: err });
  }
});

// View grades for a class (student)
router.get('/class/:classId/grades', authenticateToken, async (req, res) => {
  const { classId } = req.params;
  try {
    const grades = await query(
      `SELECT a.assignment_id, a.title, g.score, g.feedback
         FROM assignments a
         LEFT JOIN submissions s ON a.assignment_id = s.assignment_id AND s.student_id = ?
         LEFT JOIN grades g ON s.submission_id = g.submission_id
        WHERE a.class_id = ?`,
      [req.user.user_id, classId]
    );
    res.json(grades);
  } catch (err) {
    console.error('Fetch grades error:', err);
    res.status(500).json({ message: 'Server error', error: err });
  }
});

module.exports = router;
