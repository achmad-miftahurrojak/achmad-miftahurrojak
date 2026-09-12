import fs from 'fs';
import path from 'path';
import { logger } from './logger';

// Root data folder, assuming the bot runs from apps/<bot>/
const DATA_DIR = path.resolve(__dirname, '../../../../data');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

export function baca<T = any>(filename: string, fallback: T): T {
  const filePath = path.join(DATA_DIR, filename);
  try {
    if (!fs.existsSync(filePath)) {
      return fallback;
    }
    const data = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(data) as T;
  } catch (err) {
    logger.error({ err, filename }, '[storage] Gagal membaca file');
    return fallback;
  }
}

export function tulis(filename: string, data: any): boolean {
  const filePath = path.join(DATA_DIR, filename);
  try {
    const tmp = filePath + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf-8');
    fs.renameSync(tmp, filePath);
    return true;
  } catch (err) {
    logger.error({ err, filename }, '[storage] Gagal menulis file');
    return false;
  }
}

export function sapuYangRusak() {
  if (!fs.existsSync(DATA_DIR)) return;
  for (const f of fs.readdirSync(DATA_DIR)) {
    if (f.endsWith('.tmp')) {
      try { fs.unlinkSync(path.join(DATA_DIR, f)); } catch { /* ignore */ }
    }
  }
}
