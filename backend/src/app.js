const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const logger = require('./utils/logger');
const authRoutes = require('./routes/auth');
const messageRoutes = require('./routes/messages');
const userRoutes = require('./routes/users');
const { errorHandler } = require('./middleware/errorHandler');

const app = express();

// Security headers
app.use(helmet());

app.use(cors({
  origin: process.env.CLIENT_URL || 'https://localhost:5173',
  credentials: true
}));
app.use(express.json({ limit: '1mb' }));

app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });
  next();
});

app.use('/api/auth', authRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/users', userRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

logger.info('Routes registered', {
  routes: ['/api/auth', '/api/messages', '/api/users', '/api/health']
});

// 404 handler — log unmatched routes for debugging
app.use((req, res) => {
  logger.info('Route not found', { method: req.method, path: req.path });
  res.status(404).json({ error: 'Not found' });
});

app.use(errorHandler);

module.exports = app;
