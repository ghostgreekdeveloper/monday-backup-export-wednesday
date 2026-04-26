/*
 * Wednesday – Monday Backup Enterprise
 * Copyright (c) 2026 ghostgreekdeveloper
 * Licensed for personal, non-commercial use only.
 * Commercial use requires permission: Discord @greekdeveloper
 * GitHub: https://github.com/ghostgreekdeveloper
*/

/*
 * Wednesday 
* Application logger – supports live timezone changes and UTC offset display.
 * Logs to console and files (app.log, error.log).
*/

import winston from 'winston';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { getTimeZone } from './timezone.js';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const logDir = path.join(__dirname, '../../logs');

try {
  await fs.mkdir(logDir, { recursive: true });
} catch (error) {
  console.error('Failed to create log directory:', error);
}

// Helper to build UTC offset string like "UTC+2", "UTC-5"
function getUTCOffsetAbbreviation(tz) {
  try {
    const now = new Date();
    Intl.DateTimeFormat(undefined, { timeZone: tz }).format(now); // validate

    const localFormatter = new Intl.DateTimeFormat('en-GB', {
      timeZone: tz,
      hour: 'numeric',
      minute: 'numeric',
      hour12: false
    });
    const utcFormatter = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'UTC',
      hour: 'numeric',
      minute: 'numeric',
      hour12: false
    });

    const localParts = localFormatter.formatToParts(now);
    const utcParts = utcFormatter.formatToParts(now);

    const getValue = (parts, type) => parts.find(p => p.type === type)?.value;
    const localHour = parseInt(getValue(localParts, 'hour') || '0', 10);
    const utcHour = parseInt(getValue(utcParts, 'hour') || '0', 10);

    let diff = localHour - utcHour;
    if (diff > 12) diff -= 24;
    if (diff < -12) diff += 24;

    const sign = diff >= 0 ? '+' : '-';
    const abs = Math.abs(diff);
    return `UTC${sign}${abs}`;
  } catch (e) {
    return 'UTC';
  }
}

const timestampWithOffset = () => {
  let tz = getTimeZone();
  if (!tz || typeof tz !== 'string' || tz.trim().length === 0) tz = 'UTC';

  const now = new Date();
  let formatter;
  try {
    formatter = new Intl.DateTimeFormat('en-GB', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
  } catch (e) {
    formatter = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'UTC',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
    tz = 'UTC';
  }

  const parts = formatter.formatToParts(now);
  const dateObj = {};
  parts.forEach(p => { if (p.type !== 'literal') dateObj[p.type] = p.value; });
  const ts = `${dateObj.day}-${dateObj.month}-${dateObj.year} ${dateObj.hour}:${dateObj.minute}:${dateObj.second}`;
  const offset = getUTCOffsetAbbreviation(tz);
  return { ts, offset };
};

const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.printf(({ level, message, ...meta }) => {
    const { ts, offset } = timestampWithOffset();
    let msg = `[${ts}] (${offset}) ${level}: ${message}`;
    if (Object.keys(meta).length && meta.stack) msg += `\n${meta.stack}`;
    else if (Object.keys(meta).length) msg += ` ${JSON.stringify(meta)}`;
    return msg;
  })
);

const fileFormat = winston.format.combine(
  winston.format.printf(({ level, message, ...meta }) => {
    const { ts, offset } = timestampWithOffset();
    let msg = `[${ts}] (${offset}) ${level.toUpperCase()}: ${message}`;
    if (Object.keys(meta).length) msg += ` ${JSON.stringify(meta)}`;
    return msg;
  })
);

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  transports: [
    new winston.transports.Console({ format: consoleFormat }),
    new winston.transports.File({
      filename: path.join(logDir, 'app.log'),
      format: fileFormat,
      maxsize: 10485760,
      maxFiles: 10
    }),
    new winston.transports.File({
      filename: path.join(logDir, 'error.log'),
      level: 'error',
      format: fileFormat,
      maxsize: 10485760,
      maxFiles: 5
    })
  ]
});

const tz = getTimeZone() || 'UTC';
console.log(`📝 Logger initialized – current timezone: ${tz}`);
export default logger;