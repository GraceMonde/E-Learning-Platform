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
const materialRoutes = require('./routes/materials');
const assignmentRoutes = require('./routes/assignments');

const app = express();
app.use(cors());
// Increase payload limits to allow larger file uploads encoded in JSON
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve static files
app.use(express.static(path.join(__dirname, '../elearning-frontend')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Serve the welcome page for "/"
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../elearning-frontend/pages/welcome.html'));
});

// Use route skeletons
app.use('/api/user', userRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/classes', classRoutes);
app.use('/api/materials', materialRoutes);
app.use('/api/assignments', assignmentRoutes);

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:5000`);
});
