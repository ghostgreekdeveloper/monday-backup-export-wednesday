/*
 * Wednesday – Monday Backup Enterprise
 * Copyright (c) 2026 ghostgreekdeveloper
 * Licensed for personal, non-commercial use only.
 * Commercial use requires permission: Discord @greekdeveloper
 * GitHub: https://github.com/ghostgreekdeveloper
*/

/*
 * Wednesday
 * Server Entry Point
 * Initialises settings and cron jobs, starts HTTP server.
*/

import app from './app.js';
import env from './config/env.js';
import logger from './config/logger.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { updateCronJob } from './jobs/cron.js';
import { setTimeZone } from './config/timezone.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function initializeFromSettings() {
  try {
    const settingsPath = path.join(__dirname, 'config/settings/app.json');
    const data = await fs.readFile(settingsPath, 'utf-8');
    const settings = JSON.parse(data);

    if (settings.timezone) {
      setTimeZone(settings.timezone);
      logger.info(`🕐 Logger timezone set to: ${settings.timezone}`);
    }

    if (typeof settings.logs?.http === 'boolean') {
      const { setHttpLogEnabled } = await import('./config/httpLogState.js');
      setHttpLogEnabled(settings.logs.http);
      logger.info(`HTTP logging ${settings.logs.http ? 'enabled' : 'disabled'}`);
    }

    if (settings.autoBackup) {
      const tz = settings.timezone || env.timezone || 'UTC';
      updateCronJob(settings.autoBackup, tz);
      logger.info('✅ Cron job initialized from settings');
    }
  } catch (error) {
    logger.warn('⚠️ Settings file not found, using .env defaults');
    if (process.env.CRON_ENABLED === 'true') {
      const { startCronJob } = await import('./jobs/cron.js');
      startCronJob();
    }
  }
}

const server = app.listen(env.port, async () => {
  await initializeFromSettings();
  logger.info(`🚀 Monday Backup Enterprise running on http://localhost:${env.port}`);
  logger.info(`📁 Backup directory: ${env.outputDir}`);
  logger.info(`🌍 Timezone: ${env.timezone}`);
});

process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(() => process.exit(0));
});
process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  server.close(() => process.exit(0));
});