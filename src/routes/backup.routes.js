/*
 * Wednesday – Monday Backup Enterprise
 * Copyright (c) 2026 ghostgreekdeveloper
 * Licensed for personal, non-commercial use only.
 * Commercial use requires permission: Discord @greekdeveloper
 * GitHub: https://github.com/ghostgreekdeveloper
*/


/*
 * Wednesday 
 * All API routes: backup, tree, preview, search, settings, etc.
 * Uses shared settings, timezone, HTTP log toggle.
 */
import { Router } from 'express';
import fs from 'fs/promises';
import path from 'path';
import xlsx from 'xlsx';
import { fileURLToPath } from 'url';
import env, { hasMondayCredentials } from '../config/env.js';
import { runBackup } from '../services/backup.service.js';
import logger from '../config/logger.js';
import { updateCronJob } from '../jobs/cron.js';
import { setHttpLogEnabled } from '../config/httpLogState.js';
import { setTimeZone } from '../config/timezone.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const settingsPath = path.resolve(__dirname, '../config/settings/app.json');
const router = Router();

const defaultSettings = {
  theme: 'light',
  language: 'en',
  companyName: '',
  filenameFormat: 'DD-MM-YYYY',
  timezone: 'Europe/Athens',
  autoBackup: { enabled: true, frequency: 'daily', hour: 11, minute: 50, intervalHours: 12 },
  logs: { console: true, file: true, http: true },
  display: { zoom: 100, groupColors: true }
};

let appSettings = { ...defaultSettings };

async function loadSettings() {
  try {
    const data = await fs.readFile(settingsPath, 'utf-8');
    appSettings = JSON.parse(data);
    logger.info('✅ Settings loaded from ' + settingsPath);
    if (typeof appSettings.logs?.http === 'boolean') {
      setHttpLogEnabled(appSettings.logs.http);
    }
    if (appSettings.timezone) {
      setTimeZone(appSettings.timezone);
    }
  } catch (error) {
    logger.warn('Could not load settings, using defaults');
    appSettings = { ...defaultSettings };
    await saveSettingsToFile();
  }
  return appSettings;
}

async function saveSettingsToFile() {
  try {
    await fs.mkdir(path.dirname(settingsPath), { recursive: true });
    await fs.writeFile(settingsPath, JSON.stringify(appSettings, null, 2), 'utf-8');
    logger.info('💾 Settings saved to ' + settingsPath);
  } catch (e) {
    logger.error('Failed to write settings file: ' + e.message);
  }
}

await loadSettings();

const ok = (res, data = {}) => res.json({ success: true, ...data });
const fail = (res, code, message) => {
  logger.warn(`API Error (${code}): ${message}`);
  return res.status(code).json({ success: false, message });
};

router.use((req, res, next) => {
  if (appSettings?.logs?.http ?? true) {
    logger.debug(`API ${req.method} ${req.path}`);
  }
  next();
});

// Trigger manual backup
router.get('/export', async (req, res) => {
  logger.info('📤 Export request received');
  try {
    if (!hasMondayCredentials()) return fail(res, 400, 'Missing Monday.com credentials');
    const result = await runBackup({
      companyName: appSettings.companyName,
      filenameFormat: appSettings.filenameFormat,
      timezone: appSettings.timezone
    });
    return ok(res, { file: result.excelFile, logFile: result.logFile, message: 'Backup completed successfully' });
  } catch (e) {
    logger.error(`Export failed: ${e.message}`);
    return fail(res, 500, e.message || 'Backup failed');
  }
});

// Tree of all backups
router.get('/tree', async (req, res) => {
  try {
    const years = await fs.readdir(env.outputDir).catch(() => []);
    const items = [];
    for (const year of years.sort().reverse()) {
      const yearPath = path.join(env.outputDir, year);
      if (!(await fs.stat(yearPath)).isDirectory()) continue;
      const months = await fs.readdir(yearPath).catch(() => []);
      const monthData = [];
      for (const month of months.sort().reverse()) {
        const monthPath = path.join(yearPath, month);
        if (!(await fs.stat(monthPath)).isDirectory()) continue;
        const files = await fs.readdir(monthPath).catch(() => []);
        const excelFiles = files.filter(f => f.endsWith('.xlsx')).sort().reverse();
        if (excelFiles.length) monthData.push({ name: month, files: excelFiles });
      }
      if (monthData.length) items.push({ year, months: monthData });
    }
    return ok(res, { items });
  } catch (e) {
    logger.error(`Tree fetch failed: ${e.message}`);
    return fail(res, 500, 'Unable to load backup folders');
  }
});

// Search across backups (only selected files)
router.get('/search', async (req, res) => {
  try {
    const q = (req.query.q || '').toLowerCase();
    if (!q) return ok(res, { results: [] });

    const fileList = req.query.files ? req.query.files.split(',') : [];
    if (fileList.length === 0) return ok(res, { results: [] });

    const results = [];

    for (const filePath of fileList) {
      const parts = filePath.split('/');
      if (parts.length < 3) continue;
      const year = parts[0], month = parts[1], file = parts[2];
      const excelPath = path.join(env.outputDir, year, month, file);
      const baseName = file.replace('.xlsx', '');
      const metaPath = path.join(env.outputDir, year, month, `${baseName}.meta.json`);

      try { await fs.access(excelPath); } catch { continue; }

      const wb = xlsx.readFile(excelPath);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = xlsx.utils.sheet_to_json(ws, { header: 1 });

      let metadata = { groups: [], columns: [], items: [], companyName: '' };
      try {
        const metaContent = await fs.readFile(metaPath, 'utf-8');
        metadata = JSON.parse(metaContent);
      } catch (e) { /* use defaults */ }

      const fullStructured = parseExcelToStructure(rows, metadata);

      const filteredGroups = [];
      for (const group of fullStructured.groups) {
        const matchingItems = group.items.filter(item =>
          item.name.toLowerCase().includes(q) ||
          Object.values(item.values).some(v => String(v).toLowerCase().includes(q))
        );
        if (matchingItems.length > 0 || group.name.toLowerCase().includes(q)) {
          filteredGroups.push({
            ...group,
            items: matchingItems.length > 0 ? matchingItems : group.items
          });
        }
      }

      if (filteredGroups.length > 0) {
        results.push({
          file: filePath,
          companyName: metadata.companyName || '',
          headers: fullStructured.headers,
          groups: filteredGroups
        });
      }
    }

    return ok(res, { results });
  } catch (e) {
    logger.error(`Search failed: ${e.message}`);
    return fail(res, 500, 'Search failed');
  }
});

// Preview a single backup file
router.get('/preview/:year/:month/:file', async (req, res) => {
  try {
    const { year, month, file } = req.params;
    const baseName = file.replace('.xlsx', '');
    const excelPath = path.join(env.outputDir, year, month, file);
    const metaPath = path.join(env.outputDir, year, month, `${baseName}.meta.json`);
    const wb = xlsx.readFile(excelPath);
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = xlsx.utils.sheet_to_json(ws, { header: 1 });

    let metadata = { groups: [], columns: [], items: [], companyName: appSettings.companyName || '' };
    try {
      const metaContent = await fs.readFile(metaPath, 'utf-8');
      metadata = JSON.parse(metaContent);
    } catch (e) { /* fallback */ }

    const structured = parseExcelToStructure(rows, metadata);
    return ok(res, {
      rows,
      structured,
      metadata: { companyName: metadata.companyName || appSettings.companyName || '' }
    });
  } catch (e) {
    logger.error(`Preview failed: ${e.message}`);
    return fail(res, 500, 'Unable to preview excel file');
  }
});

// Parse Excel rows into groups (reused by preview and search)
function parseExcelToStructure(rows, metadata) {
  const groups = [];
  let currentGroup = null;
  let headers = [];
  let inItems = false;
  const itemColorMap = new Map();
  metadata.items?.forEach(item => {
    const cellMap = new Map();
    item.cells.forEach(c => cellMap.set(c.columnId, c.color));
    itemColorMap.set(item.name, cellMap);
  });

  const companyName = metadata.companyName || '';

  for (const row of rows) {
    if (!row || row.length === 0) continue;
    const firstCell = row[0];
    if (firstCell === companyName) continue;
    if (row.every(c => !c || c === '')) continue;

    const hasOnlyFirst = row.length === 1 || row.slice(1).every(c => !c || c === '');
    if (hasOnlyFirst && firstCell && firstCell !== 'Item Name' && firstCell !== 'Summary') {
      const groupMeta = metadata.groups.find(g => g.name === firstCell);
      currentGroup = { name: firstCell, color: groupMeta?.color || '#808080', items: [] };
      groups.push(currentGroup);
      inItems = false;
      continue;
    }

    if (firstCell === 'Item Name') {
      headers = row.slice(1).filter(h => h);
      inItems = true;
      continue;
    }

    if (firstCell === 'Summary') continue;

    if (inItems && currentGroup) {
      const itemColors = itemColorMap.get(firstCell) || new Map();
      const values = {}, colors = {};
      row.slice(1).forEach((val, idx) => {
        const header = headers[idx];
        if (header) {
          values[header] = val || '';
          const colMeta = metadata.columns?.find(c => c.title === header);
          if (colMeta) {
            const color = itemColors.get(colMeta.id);
            if (color) colors[header] = color;
          }
        }
      });
      currentGroup.items.push({ name: firstCell, values, colors });
    }
  }
  return { groups, headers };
}

// Download a backup file
router.get('/download/:year/:month/:file', async (req, res) => {
  try {
    const filePath = path.join(env.outputDir, req.params.year, req.params.month, req.params.file);
    await fs.access(filePath);
    res.download(filePath);
  } catch { return fail(res, 404, 'File not found'); }
});

// Delete a backup and its logs
router.delete('/delete/:year/:month/:file', async (req, res) => {
  try {
    const filePath = path.join(env.outputDir, req.params.year, req.params.month, req.params.file);
    await fs.unlink(filePath);
    const baseName = filePath.replace('.xlsx', '');
    await fs.unlink(baseName + '.log.txt').catch(() => {});
    await fs.unlink(baseName + '.meta.json').catch(() => {});
    logger.info(`Deleted backup: ${filePath}`);
    return ok(res, { message: 'File deleted' });
  } catch (e) {
    logger.error(`Delete failed: ${e.message}`);
    return fail(res, 500, 'Unable to delete file');
  }
});

// System status
router.get('/status', async (req, res) => {
  try {
    const hasCreds = hasMondayCredentials();
    let lastBackup = null;
    try {
      const years = await fs.readdir(env.outputDir);
      if (years.length) {
        const latestYear = years.sort().reverse()[0];
        const months = await fs.readdir(path.join(env.outputDir, latestYear));
        if (months.length) {
          const latestMonth = months.sort().reverse()[0];
          const files = await fs.readdir(path.join(env.outputDir, latestYear, latestMonth));
          const excelFiles = files.filter(f => f.endsWith('.xlsx'));
          if (excelFiles.length) lastBackup = `${latestYear}/${latestMonth}/${excelFiles.sort().reverse()[0]}`;
        }
      }
    } catch {}

    return ok(res, {
      credentials: hasCreds,
      cronEnabled: appSettings?.autoBackup?.enabled || false,
      cronSchedule: appSettings?.autoBackup?.frequency === 'daily'
        ? `Daily at ${appSettings.autoBackup.hour}:${appSettings.autoBackup.minute}`
        : `Every ${appSettings.autoBackup?.intervalHours || 12} hours`,
      lastBackup,
      outputDir: env.outputDir,
      settings: appSettings
    });
  } catch (e) { return fail(res, 500, e.message); }
});

// Health check
router.get('/health', (req, res) => {
  ok(res, { status: 'healthy', timestamp: new Date().toISOString(), uptime: process.uptime() });
});

// System logs (last 500 lines)
router.get('/logs', async (req, res) => {
  try {
    const logPath = path.join(process.cwd(), 'logs/app.log');
    const content = await fs.readFile(logPath, 'utf-8');
    const lines = content.split('\n').filter(l => l.trim()).slice(-500);
    return ok(res, { logs: lines });
  } catch (e) { return fail(res, 500, 'Unable to read logs'); }
});

// Get current settings
router.get('/settings', async (req, res) => ok(res, { settings: appSettings }));

// Get backup-specific log
router.get('/log/:year/:month/:file', async (req, res) => {
  try {
    const logPath = path.join(env.outputDir, req.params.year, req.params.month, req.params.file.replace('.xlsx', '.log.txt'));
    const content = await fs.readFile(logPath, 'utf-8');
    return ok(res, { content });
  } catch { return fail(res, 404, 'Log file not found'); }
});

// Save settings
router.post('/settings', async (req, res) => {
  try {
    const newSettings = req.body;
    appSettings = {
      ...appSettings,
      theme: newSettings.theme ?? appSettings.theme,
      language: newSettings.language ?? appSettings.language,
      companyName: newSettings.companyName ?? appSettings.companyName,
      filenameFormat: newSettings.filenameFormat ?? appSettings.filenameFormat,
      timezone: newSettings.timezone ?? appSettings.timezone,
      autoBackup: { ...appSettings.autoBackup, ...newSettings.autoBackup },
      logs: { ...appSettings.logs, ...newSettings.logs },
      display: { ...appSettings.display, ...newSettings.display }
    };

    await saveSettingsToFile();

    if (typeof appSettings.logs?.http === 'boolean') {
      setHttpLogEnabled(appSettings.logs.http);
      logger.info(`HTTP logging ${appSettings.logs.http ? 'enabled' : 'disabled'}`);
    }
    if (appSettings.timezone) setTimeZone(appSettings.timezone);

    updateCronJob(appSettings.autoBackup, appSettings.timezone);

    return ok(res, { message: 'Settings saved successfully' });
  } catch (e) {
    logger.error(`Settings save failed: ${e.message}`);
    return fail(res, 500, 'Unable to save settings: ' + e.message);
  }
});

export default router;