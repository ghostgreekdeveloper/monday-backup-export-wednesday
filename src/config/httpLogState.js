/*
 * Wednesday – Monday Backup Enterprise
 * Copyright (c) 2026 ghostgreekdeveloper
 * Licensed for personal, non-commercial use only.
 * Commercial use requires permission: Discord @greekdeveloper
 * GitHub: https://github.com/ghostgreekdeveloper
*/

/*
 * Wednesday 
 * Shared HTTP log toggle – controlled by app settings.
 * Created by ghostgreekdeveloper – Open Source under MIT License
*/

let httpLogEnabled = true;

export function setHttpLogEnabled(enabled) {
  httpLogEnabled = enabled;
}

export function isHttpLogEnabled() {
  return httpLogEnabled;
}