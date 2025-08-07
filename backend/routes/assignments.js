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

// Directory for assignment resources
const resourceDir = path.join(__dirname, '../uploads/assignments');
if (!fs.existsSync(resourceDir)) {
  fs.mkdirSync(resourceDir, { recursive: true });
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
      `SELECT a.assignment_id, a.title, a.description, a.due_date, a.resource_url,
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
  const { title, description, due_date, resourceName, resourceData } = req.body;
  if (!title) {
    return res.status(400).json({ message: 'Title is required.' });
  }
  try {
    const classes = await query('SELECT instructor_id FROM classes WHERE class_id = ?', [classId]);
    if (classes.length === 0 || classes[0].instructor_id !== req.user.user_id) {
      return res.status(403).json({ message: 'Not authorized to create assignment for this class.' });
    }
    let resourceUrl = null;
    if (resourceName && resourceData) {
      const buffer = Buffer.from(resourceData, 'base64');
      const classDir = path.join(resourceDir, String(classId));
      if (!fs.existsSync(classDir)) {
        fs.mkdirSync(classDir, { recursive: true });
      }
      const storedName = `${Date.now()}-${resourceName}`;
      fs.writeFileSync(path.join(classDir, storedName), buffer);
      resourceUrl = `/uploads/assignments/${classId}/${storedName}`;
    }
    const result = await query(
      'INSERT INTO assignments (class_id, title, description, due_date, resource_url) VALUES (?, ?, ?, ?, ?)',
      [classId, title, description, due_date, resourceUrl]
    );
    res.status(201).json({ assignment_id: result.insertId, resource_url: resourceUrl });
  } catch (err) {
    console.error('Create assignment error:', err);
    res.status(500).json({ message: 'Server error', error: err });
  }
});

// Edit assignment details
router.put('/:assignmentId', authenticateToken, async (req, res) => {
  const { assignmentId } = req.params;
  const { title, description, due_date, resourceName, resourceData } = req.body;
  try {
    const rows = await query(
      `SELECT a.assignment_id, a.class_id, a.resource_url, c.instructor_id
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
    if (resourceName && resourceData) {
      const buffer = Buffer.from(resourceData, 'base64');
      const classDir = path.join(resourceDir, String(rows[0].class_id));
      if (!fs.existsSync(classDir)) {
        fs.mkdirSync(classDir, { recursive: true });
      }
      const storedName = `${Date.now()}-${resourceName}`;
      fs.writeFileSync(path.join(classDir, storedName), buffer);
      const resourceUrl = `/uploads/assignments/${rows[0].class_id}/${storedName}`;
      fields.push('resource_url = ?');
      params.push(resourceUrl);
      if (rows[0].resource_url) {
        const oldPath = path.join(__dirname, '..', rows[0].resource_url);
        if (fs.existsSync(oldPath)) {
          fs.unlinkSync(oldPath);
        }
      }
    }
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
    const rows = await query('SELECT class_id, due_date FROM assignments WHERE assignment_id = ?', [assignmentId]);
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Assignment not found.' });
    }
    const { class_id, due_date } = rows[0];
    if (due_date && new Date() > new Date(due_date)) {
      return res.status(400).json({ message: 'Deadline has passed.' });
    }
    const buffer = Buffer.from(fileData, 'base64');
    const userDir = path.join(submissionDir, String(class_id), String(req.user.user_id));
    if (!fs.existsSync(userDir)) {
      fs.mkdirSync(userDir, { recursive: true });
    }
    const storedName = `${Date.now()}-${fileName}`;
    const filePath = path.join(userDir, storedName);
    fs.writeFileSync(filePath, buffer);
    const fileUrl = `/uploads/submissions/${class_id}/${req.user.user_id}/${storedName}`;
    const existing = await query(
      'SELECT submission_id, file_url FROM submissions WHERE assignment_id = ? AND student_id = ?',
      [assignmentId, req.user.user_id]
    );
    if (existing.length > 0) {
      const oldPath = path.join(__dirname, '..', existing[0].file_url);
      if (fs.existsSync(oldPath)) {
        fs.unlinkSync(oldPath);
      }
      await query(
        'UPDATE submissions SET file_url = ?, submitted_at = NOW() WHERE submission_id = ?',
        [fileUrl, existing[0].submission_id]
      );
      await query('DELETE FROM grades WHERE submission_id = ?', [existing[0].submission_id]);
      return res.json({ submission_id: existing[0].submission_id, file_url: fileUrl });
    }
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
      `SELECT a.assignment_id, a.title, a.resource_url, g.score, g.feedback
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
