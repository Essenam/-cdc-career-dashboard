require('dotenv').config();

// Validate required env vars before loading anything that might silently fail
const REQUIRED_ENV = ['SUPABASE_URL', 'SUPABASE_KEY', 'STAFF_PASSWORD', 'JWT_SECRET'];
const missing = REQUIRED_ENV.filter(k => !process.env[k]);
if (missing.length > 0) {
  console.error(`[startup] Missing required environment variables: ${missing.join(', ')}`);
  process.exit(1);
}

const express = require('express');
const cors = require('cors');
const path = require('path');
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

app.use((req, res, next) => {
  // In production same-origin mode (Express serves the React build), browsers
  // still send Origin on POST requests — allow it when it matches our own host.
  const origin = req.headers.origin;
  const host   = req.headers.host;
  if (!origin || (host && origin.includes(host))) return next();
  cors({
    origin: (o, cb) => {
      if (!o) return cb(null, true);
      if (allowedOrigins) {
        return allowedOrigins.includes(o)
          ? cb(null, true)
          : cb(new Error(`CORS: origin ${o} not allowed`));
      }
      // Dev default: any localhost/127.0.0.1/[::1]
      if (/^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(o)) return cb(null, true);
      cb(new Error(`CORS: origin ${o} not allowed`));
    }
  })(req, res, next);
});

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

// Serve React build in production (same-origin — no CORS needed)
// Must come before the error handler so unmatched routes fall through to index.html
if (process.env.NODE_ENV === 'production') {
  const buildPath = path.resolve(__dirname, '../../frontend/build').replace(/\\/g, '/');
  app.use(express.static(buildPath));
  app.use((_req, res) => res.sendFile(buildPath + '/index.html'));
}

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
