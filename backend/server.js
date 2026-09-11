const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const http = require('http');
const socketIo = require('socket.io');

dotenv.config();

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 5000;

// Socket.io Setup
const io = socketIo(server, {
    cors: {
        origin: "http://localhost:5173",
        methods: ["GET", "POST"]
    }
});

io.on('connection', (socket) => {
    console.log(`New client connected: ${socket.id}`);
    socket.on('disconnect', () => {
        console.log(`Client disconnected: ${socket.id}`);
    });
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Attach io to req object
app.use((req, res, next) => {
    req.io = io;
    next();
});

// Database Connection
mongoose.connect(process.env.MONGO_URI)
.then(() => console.log('MongoDB connected successfully'))
.catch(err => console.error('MongoDB connection error:', err));

// Routes
const authRoutes = require('./routes/authRoutes');
const rescueRoutes = require('./routes/rescueRoutes');
const animalRoutes = require('./routes/animalRoutes');

// Basic Route
app.get('/', (req, res) => {
    res.send('AniResQ API is running');
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/rescues', rescueRoutes);
app.use('/api/animals', animalRoutes);

// Start Server
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
