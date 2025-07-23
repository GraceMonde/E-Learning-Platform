// Load environment variables
require('dotenv').config();

// Load dependencies
const express = require('express');
const cors = require('cors');
const db = require('./config/db');

// Import route skeletons (to be created)
const userRoutes = require('./routes/user');
const authRoutes = require('./routes/auth');
const profileRoutes = require('./routes/profile');

// Initialize app
const app = express();
app.use(cors());
app.use(express.json());

// Use route skeletons
app.use('/api/user', userRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/profile', profileRoutes);

// Test Route
app.get('/', (req, res) => {
    res.send('E-learning Platform API Running');
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:5000`);
});
