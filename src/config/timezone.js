/*
 * Wednesday – Monday Backup Enterprise
 * Copyright (c) 2026 ghostgreekdeveloper
 * Licensed for personal, non-commercial use only.
 * Commercial use requires permission: Discord @greekdeveloper
 * GitHub: https://github.com/ghostgreekdeveloper
*/

/*
 * Wednesday 
 * Shared timezone state – allows runtime override from settings.
*/

import dotenv from 'dotenv';
dotenv.config();

let currentTz = process.env.TIMEZONE || 'UTC';

export function setTimeZone(tz) {
  if (tz && typeof tz === 'string' && tz.trim().length > 0) {
    currentTz = tz.trim();
  } else {
    currentTz = 'UTC';
  }
}

export function getTimeZone() {
  return currentTz;
}