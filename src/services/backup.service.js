/*
 * Wednesday – Monday Backup Enterprise
 * Copyright (c) 2026 ghostgreekdeveloper
 * Licensed for personal, non-commercial use only.
 * Commercial use requires permission: Discord @greekdeveloper
 * GitHub: https://github.com/ghostgreekdeveloper
*/

import fs from 'fs/promises';
import path from 'path';
import env from '../config/env.js';
import logger from '../config/logger.js';
import { fetchBoardData } from './monday.service.js';
import { buildWorkbook } from './excel.service.js';

function formatDateString(date, format) {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = String(date.getFullYear());

  switch (format) {
    case 'YYYY-MM-DD':
      return `${year}-${month}-${day}`;
    case 'DDMMYYYY':
      return `${day}${month}${year}`;
    case 'DD-MM-YYYY':
    default:
      return `${day}-${month}-${year}`;
  }
}

export async function runBackup(options = {}) {
  const startTime = Date.now();
  const now = new Date();
  const filenameFormat = options.filenameFormat || 'DD-MM-YYYY';
  const timezone = options.timezone || env.timezone;          // ⬅️ new

  // Get a date object adjusted to the chosen timezone
  const tzNow = new Date(now.toLocaleString('en-US', { timeZone: timezone }));

  const dateStr = formatDateString(tzNow, filenameFormat);

  const year = String(tzNow.getFullYear());
  const month = String(tzNow.getMonth() + 1).padStart(2, '0');
  const day = String(tzNow.getDate()).padStart(2, '0');
  const hours = String(tzNow.getHours()).padStart(2, '0');
  const minutes = String(tzNow.getMinutes()).padStart(2, '0');
  const seconds = String(tzNow.getSeconds()).padStart(2, '0');

  const baseDir = path.join(env.outputDir, year, month);
  await fs.mkdir(baseDir, { recursive: true });

  let backupNum = 1;
  let excelFile, logFile, metaFile;

  while (true) {
    const suffix = backupNum === 1 ? '' : `-n${backupNum}`;
    excelFile = path.join(baseDir, `${dateStr}${suffix}.xlsx`);
    if (!(await fileExists(excelFile))) {
      logFile = path.join(baseDir, `${dateStr}${suffix}.log.txt`);
      metaFile = path.join(baseDir, `${dateStr}${suffix}.meta.json`);
      break;
    }
    backupNum++;
  }

  const logEntry = async (level, message, data = null) => {
    const tz = timezone || 'UTC';
    const now = new Date();

    // Format timestamp with the selected timezone
    const formatter = new Intl.DateTimeFormat('en-GB', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
    const parts = formatter.formatToParts(now);
    const dateObj = {};
    parts.forEach(p => { if (p.type !== 'literal') dateObj[p.type] = p.value; });
    const ts = `${dateObj.day}-${dateObj.month}-${dateObj.year} ${dateObj.hour}:${dateObj.minute}:${dateObj.second}`;

    // Calculate UTC offset (quick method)
    const localHour = parseInt(dateObj.hour, 10);
    const utcFormatter = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'UTC',
      hour: 'numeric',
      minute: 'numeric',
      hour12: false
    });
    const utcParts = utcFormatter.formatToParts(now);
    const utcHour = parseInt(utcParts.find(p => p.type === 'hour')?.value || '0', 10);
    let diff = localHour - utcHour;
    if (diff > 12) diff -= 24;
    if (diff < -12) diff += 24;
    const sign = diff >= 0 ? '+' : '-';
    const offset = `UTC${sign}${Math.abs(diff)}`;

    const logLine = `[${ts}] (${offset}) [${level}] ${message}` + (data ? ` ${JSON.stringify(data)}` : '');
    await fs.appendFile(logFile, logLine + '\n');

    if (level === 'ERROR') logger.error(message, data);
    else if (level === 'WARN') logger.warn(message, data);
    else logger.info(message, data);
  };

  await logEntry('INFO', 'Backup process started', { year, month, day, time: `${hours}:${minutes}:${seconds}` });
  logger.info(`📁 Output: ${excelFile}`);

  try {
    await logEntry('INFO', 'Fetching data from Monday.com...');
    const data = await fetchBoardData(logEntry);
    await logEntry('INFO', `Fetched ${data.items.length} items in ${data.grouped.length} groups`);

    const companyName = options.companyName || '';

    const metadata = {
      generated: new Date().toISOString(),
      companyName,
      groups: data.grouped.map(g => ({ name: g.groupName, color: g.groupColor })),
      columns: data.columns.map(c => ({ id: c.id, title: c.title, type: c.type })),
      items: data.items.map(item => ({
        id: item.id,
        groupId: item.group?.id,
        name: item.name,
        cells: item.column_values.map(cv => ({
          columnId: cv.column.id,
          text: cv.text,
          color: cv.color || null
        }))
      }))
    };
    await fs.writeFile(metaFile, JSON.stringify(metadata, null, 2));
    await logEntry('INFO', 'Metadata saved');

    await logEntry('INFO', 'Building Excel workbook...');
    await buildWorkbook(data, excelFile, logFile, companyName);

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    await logEntry('INFO', `Backup completed successfully in ${duration}s`, { file: excelFile });

    return { excelFile, logFile, metaFile };
  } catch (error) {
    await logEntry('ERROR', `Backup failed: ${error.message}`, { stack: error.stack });
    throw error;
  }
}

async function fileExists(filePath) {
  try { await fs.access(filePath); return true; } catch { return false; }
}