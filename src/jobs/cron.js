/*
 * Wednesday – Monday Backup Enterprise
 * Copyright (c) 2026 ghostgreekdeveloper
 * Licensed for personal, non-commercial use only.
 * Commercial use requires permission: Discord @greekdeveloper
 * GitHub: https://github.com/ghostgreekdeveloper
*/

import cron from 'node-cron';
import logger from '../config/logger.js';
import env from '../config/env.js';
import { runBackup } from '../services/backup.service.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
let cronJob = null;

export function updateCronJob(autoBackup, timezone = env.timezone || 'UTC') {   // ⬅️ fallback added
  if (cronJob) {
    cronJob.stop();
    cronJob = null;
  }

  if (!autoBackup?.enabled) {
    logger.info('⏸️ Auto backup disabled');
    return;
  }

  let cronExpression;
  if (autoBackup.frequency === 'daily') {
    const hour = autoBackup.hour ?? 11;
    const minute = autoBackup.minute ?? 50;
    cronExpression = `${minute} ${hour} * * *`;
    logger.info(`⏰ Scheduled daily backup at ${hour}:${minute}`);
  } else if (autoBackup.frequency === 'interval') {
    const intervalHours = autoBackup.intervalHours ?? 12;
    cronExpression = `0 */${intervalHours} * * *`;
    logger.info(`⏰ Scheduled backup every ${intervalHours} hours`);
  } else {
    logger.warn('Invalid backup frequency, using default daily 11:50');
    cronExpression = '50 11 * * *';
  }

  // Ensure timezone is not empty
  const tz = timezone || 'UTC';

  cronJob = cron.schedule(cronExpression, async () => {
    logger.info('🔄 Running scheduled backup...');
    try {
      let companyName = '', filenameFormat = 'DD-MM-YYYY', backupTimezone = tz;
      try {
        const settingsPath = path.join(__dirname, '../config/settings/app.json');
        const data = await fs.readFile(settingsPath, 'utf-8');
        const settings = JSON.parse(data);
        companyName = settings.companyName || '';
        filenameFormat = settings.filenameFormat || 'DD-MM-YYYY';
        if (settings.timezone) backupTimezone = settings.timezone;
      } catch (e) { /* ignore */ }
      
      await runBackup({
        companyName,
        filenameFormat,
        timezone: backupTimezone
      });
      logger.info('✅ Scheduled backup completed');
    } catch (error) {
      logger.error(`❌ Scheduled backup failed: ${error.message}`);
    }
  }, {
    timezone: tz
  });

  logger.info(`📅 Cron job scheduled: ${cronExpression} (${tz})`);
}

export function stopCronJob() {
  if (cronJob) {
    cronJob.stop();
    cronJob = null;
    logger.info('Cron job stopped');
  }
}

export function startCronJob() {
  if (process.env.CRON_ENABLED !== 'true') {
    logger.info('Cron jobs disabled by .env');
    return;
  }
  const schedule = process.env.CRON_SCHEDULE || '50 11 * * *';
  const tz = env.timezone || 'UTC';    // ⬅️ fallback

  cronJob = cron.schedule(schedule, async () => {
    logger.info('Running scheduled backup (env config)');
    try {
      await runBackup();
    } catch (e) {
      logger.error(`Scheduled backup failed: ${e.message}`);
    }
  }, { timezone: tz });

  logger.info(`Cron job scheduled from .env: ${schedule}`);
}