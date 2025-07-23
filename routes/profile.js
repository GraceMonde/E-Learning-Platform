const express = require('express');
const router = express.Router();
const db = require('../config/db');
const authenticateToken = require('../middleware/auth');

// Get profile of authenticated user
router.get('/', authenticateToken, (req, res) => {
    db.query('SELECT user_id, name, email, role, created_at FROM users WHERE user_id = ?', [req.user.user_id], (err, results) => {
        if (err) return res.status(500).json({ message: 'Database error', error: err });
        if (results.length === 0) return res.status(404).json({ message: 'User not found.' });
        res.json(results[0]);
    });
});

// Update profile
router.put('/', authenticateToken, (req, res) => {
    const { name } = req.body;
    const userId = req.user.user_id;
    db.query('UPDATE users SET name = ? WHERE user_id = ?', [name, userId], (err, result) => {
        if (err) return res.status(500).json({ message: 'Database error', error: err });
        res.json({ message: 'Profile updated successfully.' });
    });
});

// Delete profile
router.delete('/', authenticateToken, (req, res) => {
    const userId = req.user.user_id;
    db.query('DELETE FROM users WHERE user_id = ?', [userId], (err, result) => {
        if (err) return res.status(500).json({ message: 'Database error', error: err });
        if (result.affectedRows === 0) return res.status(404).json({ message: 'User not found.' });
        res.json({ message: 'Profile deleted successfully.' });
    });
});

module.exports = router; 