/*
 * Wednesday – Monday Backup Enterprise
 * Copyright (c) 2026 ghostgreekdeveloper
 * Licensed for personal, non-commercial use only.
 * Commercial use requires permission: Discord @greekdeveloper
 * GitHub: https://github.com/ghostgreekdeveloper
*/

/*
 * Wednesday
 * Environment configuration with validation.
 * Reads .env, provides fallback defaults.
*/

import dotenv from 'dotenv';
dotenv.config();

const env = {
  port: process.env.PORT || 8733,
  timezone: process.env.TIMEZONE || 'UTC',
  token: (process.env.MONDAY_API_TOKEN || '').replace(/['"]/g, ''), // remove accidental quotes
  boardId: process.env.MONDAY_BOARD_ID || '',
  outputDir: process.env.OUTPUT_DIR || './backups'
};

console.log('🔧 Environment configuration loaded:');
console.log(`   PORT: ${env.port}`);
console.log(`   TIMEZONE: ${env.timezone}`);
console.log(`   OUTPUT_DIR: ${env.outputDir}`);
console.log(`   TOKEN: ${env.token ? '✓ Present' : '✗ Missing'}`);
console.log(`   BOARD_ID: ${env.boardId || '✗ Missing'}`);

export const hasMondayCredentials = () => {
  const hasToken = !!env.token;
  const hasBoardId = !!env.boardId;
  console.log(`🔍 Credentials check - Token: ${hasToken}, Board ID: ${hasBoardId}`);
  return hasToken && hasBoardId;
};

export default env;