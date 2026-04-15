const { createLogger, format, transports } = require('winston');
const path = require('path');

const { combine, timestamp, colorize, printf, json, errors } = format;

// ── Human-readable format for the console ──────────────────────────────────
const consoleFormat = combine(
  colorize({ all: true }),
  timestamp({ format: 'HH:mm:ss' }),
  errors({ stack: true }),
  printf(({ level, message, timestamp, stack, ...meta }) => {
    const extra = Object.keys(meta).length ? ' ' + JSON.stringify(meta) : '';
    return `${timestamp} [${level}] ${stack || message}${extra}`;
  })
);

// ── Structured JSON format for log files ────────────────────────────────────
const fileFormat = combine(
  timestamp(),
  errors({ stack: true }),
  json()
);

// ── Ensure logs/ dir exists at startup ─────────────────────────────────────
const logsDir = path.join(__dirname, '..', 'logs');

const logger = createLogger({
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'warn' : 'debug'),
  transports: [
    // ── Console (dev-friendly) ──────────────────────────────────────────────
    new transports.Console({ format: consoleFormat }),

    // ── Error-only log file ─────────────────────────────────────────────────
    new transports.File({
      filename : path.join(logsDir, 'error.log'),
      level    : 'error',
      format   : fileFormat,
    }),

    // ── Combined log file ───────────────────────────────────────────────────
    new transports.File({
      filename : path.join(logsDir, 'combined.log'),
      format   : fileFormat,
    }),
  ],
});

module.exports = logger;
