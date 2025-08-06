// Load environment variables 
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const db = require('./config/db');
const path = require('path'); // <-- ADD THIS LINE

const userRoutes = require('./routes/user');
const authRoutes = require('./routes/auth');
const profileRoutes = require('./routes/profile');
const classRoutes = require('./routes/classes');

const app = express();
app.use(cors());
app.use(express.json());

// Serve static files
app.use(express.static(path.join(__dirname, '../elearning-frontend')));

// Serve the welcome page for "/"
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../elearning-frontend/pages/welcome.html'));
});

// Use route skeletons
app.use('/api/user', userRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/classes', classRoutes);

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:5000`);
});
