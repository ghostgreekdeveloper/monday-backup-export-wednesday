# Wednesday – Monday Backup Enterprise

A self-hosted Node.js backup system for Monday.com boards. Exports board data to structured Excel files with group colors, item colors, and per-backup logs. Includes a built-in web dashboard with live preview, search, scheduling, and multi-language support.

---

## Table of Contents

- [Requirements](#requirements)
- [Quick Start](#quick-start)
- [Environment Variables (.env)](#environment-variables-env)
- [App Settings (app.json)](#app-settings-appjson)
- [Customization Guide](#customization-guide)
  - [Adding a New Language](#adding-a-new-language)
  - [Adding a New Timezone](#adding-a-new-timezone)
  - [Adding a New Filename Format](#adding-a-new-filename-format)
  - [Changing the Default Theme](#changing-the-default-theme)
  - [Changing the Backup Schedule](#changing-the-backup-schedule)
  - [Changing the Port](#changing-the-port)
  - [Changing the Backup Output Directory](#changing-the-backup-output-directory)
  - [Adjusting Log Settings](#adjusting-log-settings)
- [API Reference](#api-reference)
- [Project Structure](#project-structure)

---

## Requirements

- Node.js 18 or higher
- A Monday.com account with an API token
- Your Monday.com Board ID

---

## Quick Start

```bash
# 1. Clone the repo and install dependencies
npm install

# 2. Run the setup script (creates folders, .env, and default settings)
npm run setup

# 3. Open .env and fill in your Monday.com credentials
#    MONDAY_API_TOKEN=your_token_here
#    MONDAY_BOARD_ID=your_board_id_here

# 4. Start the server (auto-restarts on file changes)
npm start
```

Open your browser at `http://localhost:8733`

---

## Environment Variables (.env)

These are set in the `.env` file at the root of the project. Copy `.env.example` to `.env` to get started.

| Variable | Default | Description |
|---|---|---|
| `PORT` | `8733` | HTTP port the server listens on |
| `NODE_ENV` | `production` | Set to `development` to expose error details in API responses |
| `TIMEZONE` | `UTC` | Fallback timezone used if `app.json` has no timezone set |
| `MONDAY_API_TOKEN` | *(required)* | Your Monday.com API token |
| `MONDAY_BOARD_ID` | *(required)* | The numeric ID of the board you want to back up |
| `CRON_ENABLED` | `true` | Whether the auto-backup cron job is enabled at startup (overridden by `app.json`) |
| `CRON_SCHEDULE` | `50 11 * * *` | Cron expression used only if `app.json` cannot be loaded (fallback) |
| `OUTPUT_DIR` | `./backups` | Directory where Excel backup files are saved |
| `LOG_DIR` | `./logs` | Directory where Winston log files are saved |
| `LOG_LEVEL` | `info` | Winston log level: `error`, `warn`, `info`, `http`, `debug` |
| `LOG_CONSOLE` | `true` | *(legacy)* Enable console logging |
| `LOG_FILE` | `true` | *(legacy)* Enable file logging |
| `LOG_HTTP` | `true` | *(legacy)* Enable HTTP request logging |

> **Note:** The `LOG_*` fields in `.env` are legacy fallbacks. The dashboard Settings page controls these at runtime and writes to `app.json`.

---

## App Settings (app.json)

Located at `src/config/settings/app.json`. This file is read at startup and can be modified through the dashboard Settings page. You can also edit it directly.

```json
{
  "theme": "light",
  "language": "en",
  "companyName": "",
  "filenameFormat": "DD-MM-YYYY",
  "timezone": "Europe/Athens",
  "autoBackup": {
    "enabled": true,
    "frequency": "daily",
    "hour": 11,
    "minute": 50,
    "intervalHours": 12
  },
  "logs": {
    "console": true,
    "file": true,
    "http": true
  },
  "display": {
    "zoom": 100,
    "groupColors": true
  }
}
```

| Field | Options | Description |
|---|---|---|
| `theme` | `"light"`, `"dark"` | Dashboard color theme |
| `language` | `"en"`, `"el"`, `"sr"` | Dashboard UI language |
| `companyName` | any string | Shown as the first row in every Excel file and in the preview header |
| `filenameFormat` | `"DD-MM-YYYY"`, `"YYYY-MM-DD"`, `"DDMMYYYY"` | Date format used in backup filenames |
| `timezone` | any IANA timezone string | Used for timestamps, filenames, and the cron scheduler |
| `autoBackup.enabled` | `true`, `false` | Toggle the automatic backup cron job |
| `autoBackup.frequency` | `"daily"`, `"interval"` | `daily` runs at a specific time; `interval` runs every N hours |
| `autoBackup.hour` | `0–23` | Hour to run the daily backup |
| `autoBackup.minute` | `0–59` | Minute to run the daily backup |
| `autoBackup.intervalHours` | `1–168` | Hours between backups when frequency is `interval` |
| `logs.console` | `true`, `false` | Enable/disable console log output |
| `logs.file` | `true`, `false` | Enable/disable writing to `logs/app.log` |
| `logs.http` | `true`, `false` | Enable/disable HTTP request logging via Morgan |
| `display.zoom` | `50–200` | Default zoom level for the preview panel |
| `display.groupColors` | `true`, `false` | Whether group colors are shown in the preview |

---

## Customization Guide

### Adding a New Language

Languages are defined in `src/views/dashboard.html` inside the `translations` object (around line 973).

**Step 1 – Add your translation object:**

```js
const translations = {
  en: { ... },
  el: { ... },
  sr: { ... },
  // Add your new language here:
  fr: {
    dashboard: "Tableau de bord",
    backups: "Sauvegardes",
    systemLogs: "Journaux système",
    settings: "Paramètres",
    toggleTheme: "Changer le thème",
    createBackup: "Créer une sauvegarde",
    refresh: "Actualiser",
    backupExplorer: "📁 Explorateur",
    browseBackups: "📁 Parcourir",
    searchAcrossBackups: "🔍 Recherche dans les sauvegardes",
    download: "Télécharger",
    delete: "Supprimer",
    selectFileToPreview: "Sélectionnez un fichier à prévisualiser",
    allBackups: "Toutes les sauvegardes",
    appearance: "Apparence",
    theme: "Thème",
    language: "Langue",
    companyName: "Nom de l'entreprise",
    autoBackup: "Sauvegarde automatique",
    enableAutoBackup: "Activer les sauvegardes automatiques",
    backupFrequency: "Fréquence",
    daily: "Quotidiennement à une heure précise",
    interval: "Toutes les X heures",
    backupTime: "Heure (24h)",
    runEveryHours: "Toutes les (heures)",
    fileNaming: "Nommage des fichiers",
    filenameFormat: "Format du nom de fichier",
    logging: "Journalisation",
    consoleLog: "Journal console",
    fileLog: "Journal fichier",
    httpLog: "Journal des requêtes HTTP",
    saveSettings: "Enregistrer",
    lastBackup: "Dernier:",
    uptime: "Disponibilité:",
    selectFilesToSearch: "Sélectionnez des fichiers à rechercher",
    selectFilesAndEnterTerm: "Sélectionnez des fichiers et saisissez un terme",
    newestFirst: "Plus récent en premier",
    oldestFirst: "Plus ancien en premier",
    search: "Rechercher",
    clear: "Effacer",
    months: ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc']
  }
};
```

**Step 2 – Add the option to the language dropdowns (there are two — sidebar and Settings page):**

```html
<!-- Sidebar dropdown (~line 731) -->
<select class="lang-select" id="langSelect">
  <option value="en">English</option>
  <option value="el">Ελληνικά</option>
  <option value="sr">Српски</option>
  <option value="fr">Français</option>   <!-- add this -->
</select>

<!-- Settings page dropdown (~line 860) -->
<select name="language" class="form-select">
  <option value="en">English</option>
  <option value="el">Ελληνικά</option>
  <option value="sr">Српски</option>
  <option value="fr">Français</option>   <!-- add this -->
</select>
```

---

### Adding a New Timezone

Timezones are listed in the Settings form in `src/views/dashboard.html` (around line 901).

Add a new `<option>` inside the `#timezoneSelect` element:

```html
<select name="timezone" class="form-select" id="timezoneSelect">
  ...
  <option value="America/Toronto">UTC-5 Toronto</option>   <!-- example -->
</select>
```

The value must be a valid **IANA timezone string** (e.g. `Europe/London`, `America/New_York`). You can find the full list at [IANA Time Zone Database](https://www.iana.org/time-zones).

The timezone controls:
- Backup filename dates
- Timestamps in the per-backup `.log.txt` files
- Timestamps in `logs/app.log`
- The cron job schedule

---

### Adding a New Filename Format

Filename formats are handled in `src/services/backup.service.js` in the `formatDateString` function (line 16).

**Step 1 – Add a new case:**

```js
function formatDateString(date, format) {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = String(date.getFullYear());

  switch (format) {
    case 'YYYY-MM-DD':
      return `${year}-${month}-${day}`;
    case 'DDMMYYYY':
      return `${day}${month}${year}`;
    case 'MM-DD-YYYY':              // new format
      return `${month}-${day}-${year}`;
    case 'DD-MM-YYYY':
    default:
      return `${day}-${month}-${year}`;
  }
}
```

**Step 2 – Add the option to the Settings form in `dashboard.html`:**

```html
<select name="filenameFormat" class="form-select">
  <option value="DD-MM-YYYY">DD-MM-YYYY</option>
  <option value="YYYY-MM-DD">YYYY-MM-DD</option>
  <option value="MM-DD-YYYY">MM-DD-YYYY</option>   <!-- add this -->
</select>
```

---

### Changing the Default Theme

To change the theme that loads for new users, edit `src/config/settings/app.json`:

```json
{
  "theme": "dark"
}
```

Accepted values: `"light"` or `"dark"`.

To add a completely new theme, add a new CSS class in `dashboard.html` alongside `.dark` (line 49):

```css
.solarized {
  --bg-body: #fdf6e3;
  --bg-surface: #eee8d5;
  --text-primary: #657b83;
  --accent: #268bd2;
  /* ... etc */
}
```

Then add it as an option in both theme dropdowns and the `toggleTheme()` function.

---

### Changing the Backup Schedule

**Via the dashboard:** Go to Settings → Auto Backup. Choose Daily (pick hour and minute) or Interval (every N hours). Click Save Settings.

**Via `app.json` directly:**

```json
"autoBackup": {
  "enabled": true,
  "frequency": "daily",
  "hour": 9,
  "minute": 0,
  "intervalHours": 6
}
```

**Via `.env` (used only if `app.json` fails to load):**

```env
CRON_ENABLED=true
CRON_SCHEDULE=0 9 * * *
```

Cron expression format: `minute hour day month weekday`
Examples:
- `0 9 * * *` — every day at 09:00
- `0 */6 * * *` — every 6 hours
- `30 8 * * 1` — every Monday at 08:30

---

### Changing the Port

In `.env`:

```env
PORT=3000
```

Then access the dashboard at `http://localhost:3000`.

---

### Changing the Backup Output Directory

In `.env`:

```env
OUTPUT_DIR=./my-backups
```

Or use an absolute path:

```env
OUTPUT_DIR=D:/Monday/Backups
```

The directory is created automatically if it does not exist. Backups are organized as `OUTPUT_DIR/YYYY/MM/filename.xlsx`.

---

### Adjusting Log Settings

**Log level** – controls verbosity. Set in `.env`:

```env
LOG_LEVEL=debug
```

Levels (most → least verbose): `debug` → `http` → `info` → `warn` → `error`

**Log file size and rotation** – set in `src/config/logger.js` (lines 134–147):

```js
new winston.transports.File({
  filename: path.join(logDir, 'app.log'),
  maxsize: 10485760,   // 10 MB per file
  maxFiles: 10         // keep last 10 files
}),
new winston.transports.File({
  filename: path.join(logDir, 'error.log'),
  level: 'error',
  maxsize: 10485760,   // 10 MB per file
  maxFiles: 5          // keep last 5 error files
})
```

**HTTP logging toggle** – can be turned on/off at runtime from the dashboard Settings page (Logging → HTTP request logging). This updates `app.json` and takes effect immediately without a restart.

---

## API Reference

All endpoints are under `/api`.

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/export` | Trigger a manual backup |
| `GET` | `/api/tree` | Get the full backup folder tree |
| `GET` | `/api/preview/:year/:month/:file` | Preview a backup file as structured data |
| `GET` | `/api/search?q=term&files=y/m/f,...` | Search across selected backup files |
| `GET` | `/api/download/:year/:month/:file` | Download a backup `.xlsx` file |
| `DELETE` | `/api/delete/:year/:month/:file` | Delete a backup and its log/meta files |
| `GET` | `/api/log/:year/:month/:file` | Retrieve the per-backup log file |
| `GET` | `/api/logs` | Get the last 500 lines of the system log |
| `GET` | `/api/status` | Get credentials status, cron info, last backup |
| `GET` | `/api/health` | Health check with uptime |
| `GET` | `/api/settings` | Get current settings |
| `POST` | `/api/settings` | Save new settings (JSON body) |

---

## Project Structure

```
wednesday/
├── src/
│   ├── server.js                   # Entry point
│   ├── app.js                      # Express setup
│   ├── config/
│   │   ├── env.js                  # Environment loader
│   │   ├── logger.js               # Winston logger
│   │   ├── httpLogState.js         # HTTP log toggle state
│   │   ├── timezone.js             # Runtime timezone state
│   │   └── settings/app.json       # Persisted user settings
│   ├── jobs/
│   │   └── cron.js                 # Backup scheduler
│   ├── routes/
│   │   └── backup.routes.js        # All API routes
│   ├── services/
│   │   ├── backup.service.js       # Backup orchestration
│   │   ├── monday.service.js       # Monday.com API client
│   │   └── excel.service.js        # Excel file builder
│   ├── utils/
│   │   └── errors.js               # Error classes
│   └── views/
│       └── dashboard.html          # Web dashboard (single file SPA)
├── scripts/
│   └── setup.js                    # Initial setup script
├── backups/                        # Created on first backup
│   └── YYYY/MM/
│       ├── DD-MM-YYYY.xlsx
│       ├── DD-MM-YYYY.meta.json
│       └── DD-MM-YYYY.log.txt
├── logs/                           # Created on first run
│   ├── app.log
│   └── error.log
├── .env                            # Your credentials (not committed)
├── .env.example                    # Template
├── nodemon.json
└── package.json
```
