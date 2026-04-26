/*
 * Wednesday – Monday Backup Enterprise
 * Copyright (c) 2026 ghostgreekdeveloper
 * Licensed for personal, non-commercial use only.
 * Commercial use requires permission: Discord @greekdeveloper
 * GitHub: https://github.com/ghostgreekdeveloper
*/

/*
 * Wednesday
 * Express application with Morgan HTTP logging respecting timezone and toggle.
*/

import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import backupRoutes from './routes/backup.routes.js';
import logger from './config/logger.js';
import { getTimeZone } from './config/timezone.js';

// Custom morgan token for local time
morgan.token('local-date', () => {
  const tz = getTimeZone() || 'UTC';
  const now = new Date();
  try {
    return now.toLocaleString('en-GB', {
      timeZone: tz,
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
  } catch (e) {
    return now.toLocaleString('en-GB', {
      timeZone: 'UTC',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
  }
});

const app = express();

// Conditional HTTP logging using shared state
import { isHttpLogEnabled } from './config/httpLogState.js';
app.use(morgan(':remote-addr - :remote-user [:local-date] ":method :url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent"', {
  stream: {
    write: (message) => {
      if (isHttpLogEnabled()) {
        logger.http(message.trim());
      }
    }
  }
}));

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://unpkg.com"],
      imgSrc: ["'self'", "data:"]
    }
  }
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

app.get('/', (req, res) => res.redirect('/dashboard.html'));
app.use('/api', backupRoutes);
app.use(express.static('src/views'));

app.use((req, res) => {
  logger.warn(`404 - Route not found: ${req.method} ${req.url}`);
  res.status(404).json({ success: false, message: 'Route not found' });
});

app.use((err, req, res, next) => {
  logger.error(`Unhandled error: ${err.message}`, { stack: err.stack });
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

export default app;