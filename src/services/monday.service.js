/*
 * Wednesday – Monday Backup Enterprise
 * Copyright (c) 2026 ghostgreekdeveloper
 * Licensed for personal, non-commercial use only.
 * Commercial use requires permission: Discord @greekdeveloper
 * GitHub: https://github.com/ghostgreekdeveloper
*/

import axios from 'axios';
import env from '../config/env.js';
import logger from '../config/logger.js';

// ---------- Recursive color extraction (handles status, dropdown, etc.) ----------
function extractColorFromParsed(parsed) {
  if (!parsed) return null;
  if (typeof parsed === 'string') return null; // raw hex handled separately

  // 1) Direct color property (color picker, legacy dropdown)
  if (parsed.color && typeof parsed.color === 'string') return parsed.color;

  // 2) Status column – label_style.color or label_style.background
  if (parsed.label_style) {
    if (parsed.label_style.color) return parsed.label_style.color;
    if (parsed.label_style.background) return parsed.label_style.background;
  }

  // 3) Array of selected options (multi‑select / labels)
  if (Array.isArray(parsed)) {
    for (const item of parsed) {
      if (item.color) return item.color;
      if (item.label_style) {
        if (item.label_style.color) return item.label_style.color;
        if (item.label_style.background) return item.label_style.background;
      }
    }
    return null;
  }

  // 4) Single object option with nested value
  if (parsed.value && typeof parsed.value === 'object') {
    if (parsed.value.color) return parsed.value.color;
  }

  // 5) People column – no background
  if (parsed.kind === 'person') return null;

  // 6) Deep search common array properties (labels, values, options)
  for (const key of ['labels', 'values', 'options']) {
    if (Array.isArray(parsed[key])) {
      for (const item of parsed[key]) {
        const col = extractColorFromParsed(item);
        if (col) return col;
      }
    }
  }

  return null;
}

// ---------- Parse a single column_value object ----------
function parseColumnValueWithColor(col, rawValue) {
  const result = {
    text: rawValue?.text || '',
    color: null,
    raw: rawValue?.value
  };

  if (!rawValue?.value) return result;

  try {
    const parsed = JSON.parse(rawValue.value);

    // Color picker column – value is a hex string
    if (col.type === 'color' && typeof parsed === 'string' && parsed.startsWith('#')) {
      result.color = parsed;
      result.parsed = parsed;
      return result;
    }

    // Extract background color using the recursive helper
    const foundColor = extractColorFromParsed(parsed);
    if (foundColor) result.color = foundColor;

    result.parsed = parsed;
  } catch (e) {
    // Not JSON – simple text column, no color
  }

  return result;
}

// ---------- Main fetch function ----------
export async function fetchBoardData(log = null, cursor = null, rows = []) {
  const logInfo  = (msg) => { logger.info(msg);  if (log) log('INFO', msg); };
  const logDebug = (msg) => { logger.debug(msg); if (log) log('DEBUG', msg); };
  const logError = (msg) => { logger.error(msg); if (log) log('ERROR', msg); };

  logInfo('📥 Fetching board data from Monday.com');

  if (!env.token)   throw new Error('Missing MONDAY_API_TOKEN');
  if (!env.boardId) throw new Error('Missing MONDAY_BOARD_ID');

  const query = {
    query: `query {
      boards(ids:${env.boardId}) {
        columns { id title type }
        items_page(cursor:${cursor ? `"${cursor}"` : 'null'}) {
          cursor
          items {
            id
            name
            group { id title color }
            column_values {
              column { id title type }
              text
              value
            }
          }
        }
      }
    }`
  };

  try {
    logDebug(`Request cursor: ${cursor || 'initial'}`);

    const { data } = await axios.post('https://api.monday.com/v2', query, {
      headers: {
        Authorization: env.token,
        'Content-Type': 'application/json'
      }
    });

    // Log a short summary of the API response
    if (log) {
      const responseStr = JSON.stringify(data);
      log('DEBUG', `API Response summary: ${responseStr.substring(0, 1000)}...`);
    }

    // Check for GraphQL errors
    if (data.errors?.length) {
      const errorMsg = data.errors[0].message || 'Monday API request failed';
      logError(`Monday API returned errors: ${JSON.stringify(data.errors)}`);
      throw new Error(errorMsg);
    }

    if (!data.data?.boards?.length) {
      logError('Board not found or access denied');
      throw new Error('Board not found or access denied');
    }

    const board = data.data.boards[0];
    if (!board.items_page) {
      logError('Unable to retrieve board items');
      throw new Error('Unable to retrieve board items');
    }

    // Process each item to extract colors
    const processedItems = board.items_page.items.map(item => ({
      ...item,
      column_values: item.column_values.map(cv => {
        const colDef = board.columns.find(c => c.id === cv.column.id);
        const parsed = parseColumnValueWithColor(colDef, cv);
        return {
          ...cv,
          text: parsed.text,
          color: parsed.color
        };
      })
    }));

    rows.push(...processedItems);
    logInfo(`📊 Fetched ${processedItems.length} items (Total: ${rows.length})`);

    // Handle pagination
    if (board.items_page.cursor) {
      logDebug(`More pages available, next cursor: ${board.items_page.cursor}`);
      return fetchBoardData(log, board.items_page.cursor, rows);
    }

    logInfo(`✅ Successfully fetched all ${rows.length} items with ${board.columns.length} columns`);

    // Group items by group.id
    const grouped = {};
    rows.forEach(item => {
      const groupId = item.group?.id || 'ungrouped';
      if (!grouped[groupId]) {
        grouped[groupId] = {
          groupName: item.group?.title || 'No Group',
          groupColor: item.group?.color || '#808080',
          items: []
        };
      }
      grouped[groupId].items.push(item);
    });

    const result = {
      columns: board.columns,
      items: rows,
      grouped: Object.values(grouped)
    };

    logInfo(`📦 Grouped into ${result.grouped.length} groups`);
    return result;

  } catch (error) {
    logError(`Monday API request failed: ${error.message}`);
    if (error.response) {
      logError(`Response status: ${error.response.status}`);
      logError(`Response data: ${JSON.stringify(error.response.data)}`);
    }
    throw error;
  }
}