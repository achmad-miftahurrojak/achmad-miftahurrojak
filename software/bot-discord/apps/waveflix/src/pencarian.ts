import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import { logger } from '@hamin/utils';

export interface HasilFilm {
  judul: string;
  url: string;
  deskripsi: string;
  poster: string;
  tipe: 'movie' | 'series';
}

interface ScraperError {
  code: string;
  message: string;
}

interface ScraperResponse {
  id: string;
  success: boolean;
  data?: unknown;
  error?: ScraperError;
}

let proc: ChildProcess | null = null;
let reqId = 0;
const pending = new Map<string, { resolve: (v: any) => void; reject: (e: any) => void }>();
let buf = '';

function startProc(): ChildProcess {
  const scraperPath = path.join(__dirname, '..', 'scraper', 'scraper.py');
  const py = process.env.WAVEFLIX_PYTHON || 'python3';
  const p = spawn(py, [scraperPath], {
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env, PYTHONUNBUFFERED: '1' },
  });
  p.stdout?.on('data', (chunk: Buffer) => {
    buf += chunk.toString();
    const lines = buf.split('\n');
    buf = lines.pop() || '';
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const res: ScraperResponse = JSON.parse(line);
        const cb = pending.get(res.id);
        if (cb) {
          pending.delete(res.id);
          if (res.success) cb.resolve(res.data);
          else cb.reject(new Error(res.error?.message || 'scraper error'));
        }
      } catch {
        logger.warn('[waveflix] scraper JSON parse error: ' + line.slice(0, 100));
      }
    }
  });
  p.stderr?.on('data', (chunk: Buffer) => {
    logger.warn('[waveflix scraper] ' + chunk.toString().trim());
  });
  p.on('exit', (code) => {
    logger.warn(`[waveflix scraper] exited (${code}), respawning`);
    for (const [, cb] of pending) cb.reject(new Error('scraper died'));
    pending.clear();
    proc = null;
    startProc();
  });
  proc = p;
  return p;
}

function send(action: string, payload: Record<string, unknown> = {}): Promise<unknown> {
  const id = String(++reqId);
  const p = proc || startProc();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error('scraper timeout'));
    }, 30_000);
    pending.set(id, {
      resolve: (v) => { clearTimeout(timer); resolve(v); },
      reject: (e) => { clearTimeout(timer); reject(e); },
    });
    p.stdin?.write(JSON.stringify({ id, action, ...payload }) + '\n');
  });
}

function asFilmArray(data: unknown): HasilFilm[] {
  if (!Array.isArray(data)) return [];
  return data.filter((item): item is HasilFilm =>
    typeof item === 'object' && item !== null &&
    typeof (item as any).judul === 'string' &&
    typeof (item as any).url === 'string' &&
    typeof (item as any).tipe === 'string'
  );
}

export async function cariFilm(query: string, batas = 5): Promise<HasilFilm[]> {
  const data = await send('cari_film', { query, batas });
  return asFilmArray(data);
}

export async function cariTrending(): Promise<HasilFilm[]> {
  const data = await send('cari_trending');
  return asFilmArray(data);
}