const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
require('dotenv').config();

const cron = require('node-cron');
const { apiLimiter } = require('./middleware/rateLimiter');
const paymentController = require('./controllers/paymentController');
const installmentsController = require('./controllers/installmentsController');
const setupSocket = require('./socket/chatHandler');

const app = express();
const server = http.createServer(app);

// Build allowed CORS origins from env vars.
// ALLOWED_ORIGINS is a comma-separated list of extra origins (e.g. production WP sites).
// FRONTEND_*_URL provide the dashboard origins. Localhost dev ports are always included.
const extraOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

const allowedOrigins = Array.from(new Set([
  process.env.FRONTEND_USER_URL || 'http://localhost:5173',
  process.env.FRONTEND_ADMIN_URL || 'http://localhost:5174',
  process.env.FRONTEND_TUTOR_URL || 'http://localhost:5175',
  'http://localhost:5176',
  ...extraOrigins
]));

// Socket.io setup
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
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
  origin: allowedOrigins,
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

  // Schedule daily installment reminder at 09:00 server time
  cron.schedule('0 9 * * *', () => {
    console.log('[Cron] Running installment reminder job...');
    installmentsController.runReminderCron();
  });
  console.log('⏰ Installment reminder cron scheduled (daily 09:00)');
});

module.exports = { app, server, io };
