/*
 * Wednesday – Monday Backup Enterprise
 * Copyright (c) 2026 ghostgreekdeveloper
 * Licensed for personal, non-commercial use only.
 * Commercial use requires permission: Discord @greekdeveloper
 * GitHub: https://github.com/ghostgreekdeveloper
*/

/*
 * Wednesday 
*  Initial Setup Script
 * Creates required directories and default settings file.
*/

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, '..');

async function setup() {
  console.log('📦 Setting up Monday Backup Enterprise...\n');

  const dirs = ['backups', 'logs', 'src/views', 'src/config/settings'];
  for (const dir of dirs) {
    const fullPath = path.join(rootDir, dir);
    await fs.mkdir(fullPath, { recursive: true });
    console.log(`✓ Created ${dir}`);
  }

  try {
    await fs.access(path.join(rootDir, '.env'));
    console.log('✓ .env file exists');
  } catch {
    console.log('⚠ Creating .env from .env.example');
    const example = await fs.readFile(path.join(rootDir, '.env.example'), 'utf-8');
    await fs.writeFile(path.join(rootDir, '.env'), example);
    console.log('✓ Created .env file – please add your Monday.com credentials');
  }

  // Default settings with timezone, formats, etc.
  const defaultSettings = {
    theme: 'light',
    language: 'en',
    companyName: '',
    filenameFormat: 'DD-MM-YYYY',
    timezone: 'Europe/Athens',
    autoBackup: {
      enabled: true,
      frequency: 'daily',
      hour: 11,
      minute: 50,
      intervalHours: 12
    },
    logs: {
      console: true,
      file: true,
      http: true
    },
    display: {
      zoom: 100,
      groupColors: true
    }
  };

  await fs.writeFile(
    path.join(rootDir, 'src/config/settings/app.json'),
    JSON.stringify(defaultSettings, null, 2)
  );

  console.log('\n✅ Setup complete!');
  console.log('🚀 Run "npm start" for production');
}

setup().catch(console.error);