require('dotenv').config();

// Validate required env vars before loading anything that might silently fail
const REQUIRED_ENV = ['SUPABASE_URL', 'SUPABASE_KEY', 'STAFF_PASSWORD'];
const missing = REQUIRED_ENV.filter(k => !process.env[k]);
if (missing.length > 0) {
  console.error(`[startup] Missing required environment variables: ${missing.join(', ')}`);
  process.exit(1);
}

const express = require('express');
const cors = require('cors');
const studentRoutes  = require('./routes/studentRoutes');
const staffRoutes    = require('./routes/staffRoutes');
const adminRoutes    = require('./routes/adminRoutes');
const taskRoutes     = require('./routes/taskRoutes');
const authRoutes     = require('./routes/authRoutes');
const roadmapRoutes  = require('./routes/roadmapRoutes');
const errorHandler   = require('./middleware/errorHandler');
const { requireStaffAuth } = require('./middleware/authMiddleware');

const app = express();

// CORS — allow only the configured frontend origin(s)
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(s => s.trim())
  : null; // null = dev mode: allow all localhost origins

app.use(cors({
  origin: (origin, callback) => {
    // Allow non-browser requests (curl, health checks, etc.)
    if (!origin) return callback(null, true);
    // In production, restrict to configured origins
    if (allowedOrigins) {
      return allowedOrigins.includes(origin)
        ? callback(null, true)
        : callback(new Error(`CORS: origin ${origin} not allowed`));
    }
    // Dev default: allow any localhost/127.0.0.1/[::1] origin
    if (/^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(origin)) {
      return callback(null, true);
    }
    callback(new Error(`CORS: origin ${origin} not allowed`));
  }
}));

app.use(express.json({ limit: '2mb' }));

// Health check — public
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Public routes — no staff auth required (students use these too)
app.use('/api/auth',    authRoutes);
app.use('/api/student', studentRoutes);
app.use('/api/roadmap', roadmapRoutes);
app.use('/api/tasks',   taskRoutes);

// Staff-only routes — require a valid session token
app.use('/api/staff', requireStaffAuth, staffRoutes);
app.use('/api/admin', requireStaffAuth, adminRoutes);

app.use(errorHandler);

const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => {
  console.log(`✓ CDC Backend running on http://localhost:${PORT}`);
});

process.on('SIGTERM', () => {
  console.log('SIGTERM received — shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
