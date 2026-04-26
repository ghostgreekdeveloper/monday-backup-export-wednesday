/*
 * Wednesday – Monday Backup Enterprise
 * Copyright (c) 2026 ghostgreekdeveloper
 * Licensed for personal, non-commercial use only.
 * Commercial use requires permission: Discord @greekdeveloper
 * GitHub: https://github.com/ghostgreekdeveloper
*/


import ExcelJS from 'exceljs';
import logger from '../config/logger.js';
import fs from 'fs/promises';

// ---------- Helper: Format date for Excel ----------
function formatDate(value) {
  if (!value) return '';
  try {
    const date = new Date(value);
    if (isNaN(date.getTime())) return value;
    return date.toLocaleString('en-el', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  } catch { return value; }
}

// ---------- Recursive color extractor from any Monday column value ----------
function extractColorFromParsed(parsed) {
  if (!parsed) return null;
  if (typeof parsed === 'string') {
    if (parsed.startsWith('#')) return parsed;   // color picker column
    return null;
  }
  // Direct color property (legacy dropdown, color picker object)
  if (parsed.color && typeof parsed.color === 'string') return parsed.color;
  // Status column: label_style.color
  if (parsed.label_style?.color) return parsed.label_style.color;
  // Array of selected options (multi-select dropdown/label)
  if (Array.isArray(parsed)) {
    for (const item of parsed) {
      if (item.color) return item.color;
      if (item.label_style?.color) return item.label_style.color;
    }
    return null;
  }
  // Single object option (dropdown, label) with color
  if (parsed.value && typeof parsed.value === 'object' && parsed.value.color) {
    return parsed.value.color;
  }
  // People column – no background color
  if (parsed.kind === 'person') return null;
  // Recursively check first-level properties that may contain a color
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

// ---------- Parse column value: text + background color ----------
function parseColumnValue(column, colValue) {
  if (!colValue) return { text: '', color: null };
  const type = column.type;
  let text = colValue.text || '';
  let color = colValue.color || null;     // may already be set by Monday service

  if (colValue.value) {
    try {
      const parsed = JSON.parse(colValue.value);
      // Special handling for date & time
      if (type === 'date' || type === 'creation_log') {
        const dateText = parsed.date ? formatDate(parsed.date) : text;
        return { text: dateText, color: null };
      }
      // Extract color using recursive helper
      const foundColor = extractColorFromParsed(parsed);
      if (foundColor) color = foundColor;
      // Build display text based on column type
      if (type === 'status') {
        text = parsed.label || text;
      } else if (type === 'dropdown') {
        if (Array.isArray(parsed)) {
          text = parsed.map(item => item.name || item.value).join(', ');
        } else if (parsed.values && Array.isArray(parsed.values)) {
          text = parsed.values.map(v => v.name || v.value).join(', ');
        } else if (parsed.name) {
          text = parsed.name;
        } else {
          text = text || '';
        }
      } else if (type === 'numbers' || type === 'numeric') {
        if (parsed.number !== undefined) text = parsed.number;
        else if (parsed.value !== undefined) text = parsed.value;
      } else if (type === 'color') {
        // Color picker column – value is a hex string or object
        if (typeof parsed === 'string') text = parsed;
        else if (parsed.hex) text = parsed.hex;
        color = text;   // use the color itself as the background
      }
    } catch (e) {
      // Not JSON – ignore
    }
  }
  return { text: text.toString(), color };
}

// ---------- Helper: determine if column is numeric (for sum rows) ----------
function isNumericColumn(column) {
  return column.type === 'numbers' || column.type === 'numeric';
}

// ---------- Helper: get contrasting text color (black or white) ----------
function getContrastColor(hexColor) {
  if (!hexColor) return '000000';
  const r = parseInt(hexColor.slice(1, 3), 16);
  const g = parseInt(hexColor.slice(3, 5), 16);
  const b = parseInt(hexColor.slice(5, 7), 16);
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness > 128 ? '000000' : 'FFFFFF';
}

// ---------- Main Excel builder ----------
export async function buildWorkbook(payload, filePath, logFilePath, companyName) {
  const startTime = Date.now();
  logger.info('📝 Creating Excel workbook with grouping and cell colors...');
  logger.debug(`Output path: ${filePath}`);

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Board Data');

  // Company header – uses the provided companyName, no fallback
  const companyRow = worksheet.addRow([companyName || '']);
  companyRow.font = { name: 'Arial', size: 15, bold: true };
  companyRow.height = 39.75;
  worksheet.addRow([]).height = 10;

  const columns = (payload.columns || []).filter(col => col.id !== 'name');
  const groupedData = payload.grouped || [];
  let totalItems = 0;

  logger.debug(`Processing ${groupedData.length} groups, ${columns.length} columns`);

  for (const group of groupedData) {
    const groupItems = group.items;
    totalItems += groupItems.length;

    // ----- Group row (text color only, no background) -----
    const groupRow = worksheet.addRow([group.groupName]);
    groupRow.getCell(1).font = { name: 'Arial', size: 14, bold: true };
    if (group.groupColor && group.groupColor.startsWith('#')) {
      const colorArg = group.groupColor.slice(1).toUpperCase();
      if (/^[0-9A-F]{6}$/.test(colorArg)) {
        groupRow.getCell(1).font.color = { argb: colorArg };
      }
    }
    groupRow.height = 19.5;

    // ----- Header row -----
    const headers = ['Item Name', ...columns.map(c => c.title)];
    const headerRow = worksheet.addRow(headers);
    headerRow.height = 19.5;
    headerRow.eachCell(cell => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'D9D9D9' } };
      cell.font = { name: 'Arial', size: 11, bold: true };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
    });

    const startRowNumber = worksheet.lastRow.number + 1;
    let groupQuantitySum = 0, groupTotalSum = 0;

    // ----- Item rows -----
    for (const item of groupItems) {
      const rowValues = [item.name];
      const cellColors = [null]; // for item name column (no color)

      for (const col of columns) {
        const colValue = item.column_values?.find(v => v.column.id === col.id);
        const { text, color } = parseColumnValue(col, colValue);

        let displayValue = text;
        if (isNumericColumn(col) && !isNaN(parseFloat(text))) {
          const num = parseFloat(text);
          displayValue = num;
          if (col.id === 'numbers' || col.title.toLowerCase().includes('quantity')) groupQuantitySum += num;
          if (col.id === 'numbers4' || col.title.toLowerCase().includes('total')) groupTotalSum += num;
        }
        rowValues.push(displayValue);
        cellColors.push(color); // store background color for this cell
      }

      const itemRow = worksheet.addRow(rowValues);
      itemRow.font = { name: 'Arial', size: 11 };
      itemRow.height = 20;

      itemRow.eachCell((cell, colNumber) => {
        // Center-align content (except the first column – item name)
        if (colNumber > 1) {
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
        }
        // Numeric formatting for numeric columns
        const colIndex = colNumber - 2;
        if (colIndex >= 0 && isNumericColumn(columns[colIndex])) {
          cell.numFmt = '#,##0.00';
        }
        // Apply background color and contrast text color
        const bgColor = cellColors[colNumber - 1];
        if (bgColor && /^#[0-9A-F]{6}$/i.test(bgColor)) {
          const argbColor = bgColor.slice(1).toUpperCase();
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: argbColor }
          };
          const contrastArgb = getContrastColor(bgColor);
          cell.font = { ...cell.font, color: { argb: contrastArgb } };
        }
      });
    }

    const endRowNumber = worksheet.lastRow.number;

    // ----- Sum row (if any numeric columns) -----
    if (groupQuantitySum > 0 || groupTotalSum > 0) {
      const sumRow = worksheet.addRow([]);
      sumRow.height = 20;
      const quantityColIndex = columns.findIndex(c => c.id === 'numbers' || c.title.toLowerCase().includes('quantity')) + 2;
      const totalColIndex = columns.findIndex(c => c.id === 'numbers4' || c.title.toLowerCase().includes('total')) + 2;

      if (quantityColIndex > 1) {
        const cell = sumRow.getCell(quantityColIndex);
        cell.value = {
          formula: `SUM(${worksheet.getColumn(quantityColIndex).letter}${startRowNumber}:${worksheet.getColumn(quantityColIndex).letter}${endRowNumber})`
        };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'EFEFEF' } };
        cell.numFmt = '#,##0.00';
      }
      if (totalColIndex > 1) {
        const cell = sumRow.getCell(totalColIndex);
        cell.value = {
          formula: `SUM(${worksheet.getColumn(totalColIndex).letter}${startRowNumber}:${worksheet.getColumn(totalColIndex).letter}${endRowNumber})`
        };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'EFEFEF' } };
        cell.numFmt = '#,##0.00';
      }
      sumRow.font = { name: 'Arial', size: 12, bold: true };
      sumRow.eachCell((cell) => {
        if (cell._address.col > 1) cell.alignment = { horizontal: 'center', vertical: 'middle' };
      });
    }

    worksheet.addRow([]).height = 20;
  }

  // ----- Final summary row -----
  const summaryRow = worksheet.addRow(['Summary', `Total Groups: ${groupedData.length}`, `Total Items: ${totalItems}`]);
  summaryRow.font = { name: 'Arial', size: 11, bold: true };
  summaryRow.height = 25;

  // Set column widths
  worksheet.columns.forEach((col, i) => {
    col.width = i === 0 ? 30 : 20;
  });

  // Ensure all cells (except first column) are center-aligned
  worksheet.eachRow(row => {
    row.eachCell((cell, colNumber) => {
      if (colNumber > 1) cell.alignment = { horizontal: 'center', vertical: 'middle' };
    });
  });

  // Write to file
  try {
    await workbook.xlsx.writeFile(filePath);
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    logger.info(`✅ Workbook saved: ${filePath} (${duration}s)`);
    if (logFilePath) {
      await fs.appendFile(logFilePath, `[${new Date().toISOString()}] Excel file created: ${filePath}\n`);
    }
  } catch (writeError) {
    logger.error(`Failed to write Excel file: ${writeError.message}`, { stack: writeError.stack });
    throw writeError;
  }
}