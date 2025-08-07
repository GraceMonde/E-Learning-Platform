const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
require('dotenv').config();

const { lectures } = require('../models/lectureStore');

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

// Schedule a lecture
router.post('/schedule', authenticateToken, (req, res) => {
  const { title, time } = req.body;
  if (!title || !time) {
    return res.status(400).json({ message: 'Title and time are required.' });
  }
  const lecture = {
    id: lectures.length + 1,
    title,
    time,
    participants: [],
    screenShared: false
  };
  lectures.push(lecture);
  res.status(201).json(lecture);
});

// Join a lecture
router.post('/:id/join', authenticateToken, (req, res) => {
  const lecture = lectures.find(l => l.id === parseInt(req.params.id));
  if (!lecture) return res.status(404).json({ message: 'Lecture not found.' });
  if (!lecture.participants.includes(req.user.user_id)) {
    lecture.participants.push(req.user.user_id);
  }
  res.json({ message: 'Joined lecture.' });
});

// Share screen during a lecture
router.post('/:id/share-screen', authenticateToken, (req, res) => {
  const lecture = lectures.find(l => l.id === parseInt(req.params.id));
  if (!lecture) return res.status(404).json({ message: 'Lecture not found.' });
  lecture.screenShared = true;
  res.json({ message: 'Screen sharing started.' });
});

module.exports = router;
