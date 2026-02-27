
import { InventoryItem, ReportItem } from '../types';
import { MOCK_INVENTORY } from '../constants';

// ==========================================
// CONFIGURATION FOR SAVING DATA
// ==========================================

// 1. GOOGLE APPS SCRIPT (Existing Method - Works best for Web Apps to avoid CORS)
const SHEET_ID = '10jpqJZ6voom6pUAth0MHGtkHy1VefOJjdSFt7AkjILc';
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbz0dS_UQmhML7-G0_lhnapO-FvFzndsqMHInhQVV3LqqbweyygxbHE81J6sufg0FFPXFQ/exec';

// ==========================================
// DATA FETCHING CONFIG
// ==========================================

// Direct Export URL
const EXPORT_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=0`;

// Published to Web URL
const PUB_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQ46rZhvRnGGjk8kAM-FmP8fB-zfjSV2Dl_9oRUtzoGd2KRW25YFyr86nxUTCH1bdt4NOYqimkFDPu6/pub?output=csv';

const SAVE_SHEET_ID = '1MKyqdlFx2ixWPfzl_-r3U-I3QrX3inyBwkQcdNRiNzA';
const SAVE_SHEET_URL = `https://docs.google.com/spreadsheets/d/${SAVE_SHEET_ID}/edit?gid=0#gid=0`;
const REPORT_EXPORT_URL = `https://docs.google.com/spreadsheets/d/${SAVE_SHEET_ID}/export?format=csv`;

// User List Sheet
const USER_SHEET_ID = '131WAuESBlXDaqLLIEd5oTYOEOGBYXjiE0WK--xwIi04';
const USER_SHEET_URL = `https://docs.google.com/spreadsheets/d/${USER_SHEET_ID}/export?format=csv`;


const parseCSVLine = (text: string) => {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') inQuotes = !inQuotes;
    else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else current += char;
  }
  result.push(current.trim());
  return result;
};

export const parseCSVData = (csvText: string): InventoryItem[] => {
    const lines = csvText.split('\n');
    if (lines.length < 2) return [];

    const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase().replace(/[^a-z0-9]/g, ''));
    const mapIndex = (keyPart: string) => headers.findIndex(h => h.includes(keyPart));

    const idx = {
      design: mapIndex('design'),
      item: mapIndex('item'),
      style: mapIndex('style'),
      color: mapIndex('color'),
      polish: mapIndex('polish'),
      size: mapIndex('size'),
      brand: mapIndex('brand'),
      user: mapIndex('user'),
      dummy7: mapIndex('dummy7') > -1 ? mapIndex('dummy7') : 7,
      dummy8: mapIndex('dummy8') > -1 ? mapIndex('dummy8') : 8,
      comb: mapIndex('comb'),
      date: mapIndex('date'),
      tranno: mapIndex('tranno'),
      barcode: mapIndex('barcode'),
      stk: mapIndex('stk'),
      discount: mapIndex('discount'),
    };

    const data: InventoryItem[] = [];
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      const cols = parseCSVLine(line);
      if (cols.length < 5) continue; 
      
      const getCol = (mappedIdx: number, fallback: string | number) => {
        if (mappedIdx === -1) return String(fallback);
        return cols[mappedIdx] !== undefined ? cols[mappedIdx] : String(fallback);
      };

      const combVal = getCol(idx.comb, '0');

      data.push({
        designNo: getCol(idx.design, 'NA'),
        itemName: getCol(idx.item, 'NA'),
        style: getCol(idx.style, 'NA'),
        color: getCol(idx.color, 'NA'),
        polish: getCol(idx.polish, 'NA'),
        size: getCol(idx.size, 'NA'),
        brand: getCol(idx.brand, 'NA'),
        userName: getCol(idx.user, 'NA'),
        dummy7: getCol(idx.dummy7, 'NA'),
        dummy8: getCol(idx.dummy8, 'NA'),
        combId: (combVal === '' || combVal === '0') ? 'NA' : combVal,
        tranDate: getCol(idx.date, 'NA'),
        tranNo: getCol(idx.tranno, 'NA'),
        barcodeValue: getCol(idx.barcode, 'NA'),
        currentStk: parseInt(getCol(idx.stk, 0)) || 0,
        discount: getCol(idx.discount, '0'),
      });
    }
    return data;
};

export const fetchInventoryData = async (): Promise<InventoryItem[]> => {
  const timestamp = Date.now();
  try {
    const response = await fetch(`${EXPORT_URL}&t=${timestamp}`);
    if (response.ok) {
        const text = await response.text();
        if (!text.trim().toLowerCase().startsWith('<!doctype html>') && !text.trim().toLowerCase().startsWith('<html')) {
             const data = parseCSVData(text);
             if (data.length > 0) return data;
        }
    }
  } catch (e) {
    console.warn("Direct export fetch failed, falling back to public link", e);
  }

  try {
    const response = await fetch(`${PUB_URL}&t=${timestamp}`);
    if (!response.ok) throw new Error(`Failed to fetch sheet: ${response.statusText}`);
    const csvText = await response.text();
    const data = parseCSVData(csvText);
    if (!data || data.length === 0) return MOCK_INVENTORY;
    return data;
  } catch (error) {
    console.error("Error loading Google Sheet data", error);
    return MOCK_INVENTORY;
  }
};

export const fetchUserNames = async (): Promise<string[]> => {
  try {
    const response = await fetch(`${USER_SHEET_URL}&t=${Date.now()}`);
    if (!response.ok) throw new Error("Failed to fetch users sheet");
    const text = await response.text();
    const lines = text.split('\n');
    const users = new Set<string>();
    lines.forEach(line => {
      const cleanLine = line.trim();
      if (!cleanLine) return;
      const cols = parseCSVLine(cleanLine);
      const name = cols[0]?.trim();
      if (name && name.toLowerCase() !== 'user name' && name.toLowerCase() !== 'name') {
        users.add(name);
      }
    });
    return Array.from(users).sort();
  } catch (error) {
    console.error("Error fetching user list", error);
    return [];
  }
};

export const fetchReportData = async (): Promise<ReportItem[]> => {
  const timestamp = Date.now();
  try {
    const response = await fetch(`${REPORT_EXPORT_URL}&t=${timestamp}`);
    if (!response.ok) throw new Error("Failed to fetch report sheet");
    
    const text = await response.text();
    if (text.trim().toLowerCase().startsWith('<!doctype html>')) {
        throw new Error("Cannot access report sheet. Check permissions.");
    }

    const lines = text.split('\n');
    const data: ReportItem[] = [];
    
    let startIndex = 0;
    if (lines.length > 0 && lines[0].toLowerCase().includes('design')) {
        startIndex = 1;
    }

    for (let i = startIndex; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const cols = parseCSVLine(line);
        if (cols.length < 5) continue;

        data.push({
            timestamp: cols[0] || '',
            designNo: cols[1] || '',
            itemName: cols[2] || '',
            barcode: cols[3]?.replace(/^'/, '') || '',
            tranNo: cols[4] || '',
            qty: cols[5] || '0',
            move: cols[6] || '',
            user: cols[7] || '',
            serialNo: cols[8] || '',
            discount: cols[9] || '0',
            brand: cols[14] || 'NA',
            exportStatus: cols[17] || 'NO',
            batchNo: cols[18] || '' // Column 19 (Index 18)
        });
    }
    return data.reverse();
  } catch (e) {
    console.error("Error fetching report data", e);
    return [];
  }
};

export const saveMoveToSheet = async (
  item: InventoryItem, 
  reason: string, 
  currentUser: string, 
  serialNo: string,
  qtyToMove: number,
  timestampString?: string
) => {
  const timestamp = timestampString || new Date().toLocaleString();
  const discountVal = (item.discount && item.discount !== 'NA' && item.discount.trim() !== '') 
                      ? item.discount 
                      : '0';

  const payload = {
    timestamp: timestamp,
    designNo: item.designNo,
    itemName: item.itemName,
    barcode: `'${item.barcodeValue}`,
    tranNo: item.tranNo,
    qty: qtyToMove,
    reason: reason,
    user: currentUser || 'N/A',
    serialNo: serialNo || '',
    discount: discountVal, 
    style: item.style || 'NA',
    color: item.color || 'NA',
    polish: item.polish || 'NA',
    size: item.size || 'NA',
    brand: item.brand || 'NA',
    dummy7: item.dummy7 || 'NA',
    dummy8: item.dummy8 || 'NA',
    targetSheet: SAVE_SHEET_URL
  };
  
  if (APPS_SCRIPT_URL) {
      try {
        await fetch(APPS_SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors', 
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
      } catch (error) {
        console.error("Failed to send to Apps Script", error);
      }
  }
};

export const markItemsAsExported = async (items: ReportItem[], batchNo: string = '') => {
  if (!items || items.length === 0) return;
  const payload = {
    action: 'markExported',
    batchNo: batchNo,
    items: items.map(i => ({
      timestamp: i.timestamp,
      barcode: i.barcode,
      tranNo: i.tranNo,
      reason: i.move
    })),
    targetSheet: SAVE_SHEET_URL
  };
  
  if (APPS_SCRIPT_URL) {
      try {
        await fetch(APPS_SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors', 
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
      } catch (error) {
        console.error("Failed to update export status", error);
      }
  }
};
