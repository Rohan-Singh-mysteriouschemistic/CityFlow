const express   = require('express');
const cors      = require('cors');
const helmet    = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();
require('./config/db');

const logger       = require('./config/logger');
const errorHandler = require('./middleware/errorHandler');

const app = express();

// ── Security Headers (Helmet) ────────────────────────────────────────────────
// Must be first — sets X-Content-Type-Options, X-Frame-Options, HSTS, etc.
app.use(helmet());

// ── CORS ─────────────────────────────────────────────────────────────────────
app.use(cors({ origin: true, credentials: true }));

// ── Body Parsers ──────────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Rate Limiters ─────────────────────────────────────────────────────────────
// Strict: auth endpoints — prevents brute-force on login / OTP
const authLimiter = rateLimit({
  windowMs : 15 * 60 * 1000,   // 15 minutes
  max      : 20,
  skip     : () => process.env.NODE_ENV === 'development',
  message  : { status: 'fail', message: 'Too many requests from this IP, please try again after 15 minutes.' },
  standardHeaders: true,
  legacyHeaders : false,
});

// General: all other API routes
const apiLimiter = rateLimit({
  windowMs : 15 * 60 * 1000,
  max      : 200,
  skip     : () => process.env.NODE_ENV === 'development',
  message  : { status: 'fail', message: 'Too many requests from this IP, please try again after 15 minutes.' },
  standardHeaders: true,
  legacyHeaders : false,
});

app.use('/api/auth', authLimiter);
app.use('/api',      apiLimiter);

// ── Health Check ──────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', project: 'CityFlow Delhi', time: new Date() });
});

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/auth',    require('./routes/auth'));
app.use('/api/rides',   require('./routes/rides'));
app.use('/api/drivers', require('./routes/drivers'));
app.use('/api/admin',   require('./routes/admin'));

// ── 404 handler (unmatched routes) ───────────────────────────────────────────
app.use((req, res, next) => {
  const AppError = require('./utils/AppError');
  next(new AppError(`Cannot ${req.method} ${req.originalUrl}`, 404));
});

// ── Global Error Handler (must be last) ──────────────────────────────────────
app.use(errorHandler);

// ── Start Server ──────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  logger.info(`🚀 CityFlow server running on port ${PORT}`, {
    env  : process.env.NODE_ENV || 'development',
    port : PORT,
  });
});