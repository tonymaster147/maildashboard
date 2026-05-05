const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
require('dotenv').config();

const { apiLimiter } = require('./middleware/rateLimiter');
const paymentController = require('./controllers/paymentController');
const setupSocket = require('./socket/chatHandler');

const app = express();
const server = http.createServer(app);

// Socket.io setup
const io = new Server(server, {
  cors: {
    origin: [
      process.env.FRONTEND_USER_URL || 'http://localhost:5173',
      process.env.FRONTEND_ADMIN_URL || 'http://localhost:5174',
      process.env.FRONTEND_TUTOR_URL || 'http://localhost:5175',
      'http://localhost:5176',
      'https://make-tutors.com',
      'https://www.make-tutors.com'
    ],
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Initialize socket handlers
setupSocket(io);

// Make io accessible to routes
app.set('io', io);

// Trust Traefik reverse proxy
app.set('trust proxy', 1);

// Security
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

// CORS
app.use(cors({
  origin: [
    process.env.FRONTEND_USER_URL || 'http://localhost:5173',
    process.env.FRONTEND_ADMIN_URL || 'http://localhost:5174',
    process.env.FRONTEND_TUTOR_URL || 'http://localhost:5175',
    'http://localhost:5176',
    'https://make-tutors.com',
    'https://www.make-tutors.com'
  ],
  credentials: true
}));

// Stripe webhook needs raw body (before json parser)
app.post('/api/payments/webhook', express.raw({ type: 'application/json' }), paymentController.handleWebhook);

// Body parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting
app.use('/api/', apiLimiter);

// Serve uploads statically
app.use('/uploads', express.static('uploads'));

// Routes
app.use('/api/public', require('./routes/public'));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/files', require('./routes/files'));
app.use('/api/chat', require('./routes/chat'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/tutor', require('./routes/tutor'));
app.use('/api/sales', require('./routes/sales'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handling
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`
  ╔══════════════════════════════════════════════╗
  ║  🚀 Tutoring Platform API Server            ║
  ║  📡 Running on port ${PORT}                     ║
  ║  🔌 Socket.io ready                         ║
  ║  📝 Environment: ${process.env.NODE_ENV || 'development'}            ║
  ╚══════════════════════════════════════════════╝
  `);
});

module.exports = { app, server, io };
