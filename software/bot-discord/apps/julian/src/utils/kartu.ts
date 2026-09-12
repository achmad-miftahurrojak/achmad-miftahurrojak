import { createCanvas, loadImage } from '@napi-rs/canvas';
import GIFEncoder from 'gif-encoder-2';
import * as path from 'path';
import * as fs from 'fs';
import { logger } from '@hamin/utils';

const LEBAR = 1000;
const TINGGI = 500;
const KATA_ATAS = 'WELCOME';
const KATA_BAWAH = 'YOU ARE ONE OF OUR {nomor} MEMBERS ♥';
const AVATAR = 200;
const AVATAR_ATAS = 42;
const CINCIN = 7;
const PUSAT = LEBAR / 2;
const Y_ATAS = 306;
const Y_NAMA = 379;
const Y_BAWAH = 440;
const UKURAN_ATAS = 74;
const UKURAN_NAMA = 42;
const UKURAN_BAWAH = 27;

const WARNA_ATAS = [28, 32, 56];
const WARNA_BAWAH = [68, 42, 92];
const WARNA_AKSEN = '#eef6ff';
const GARIS_TEPI = '#000000';
const GELAP = 0.3;

// Coba cari background
const possiblePaths = [
  path.join(process.cwd(), 'assets', 'images', 'welcome-bg.png'),
  path.join(process.cwd(), '..', '..', 'bot-discord-python', 'assets', 'welcome-bg.png'),
  path.join(__dirname, '..', '..', '..', '..', 'bot-discord-python', 'assets', 'welcome-bg.png')
];

let backgroundPath: string | null = null;
for (const p of possiblePaths) {
  if (fs.existsSync(p)) {
    backgroundPath = p;
    break;
  }
}

logger.info(`[kartu] latar: ${backgroundPath || 'gradasi bawaan'}`);

function drawTextWithStroke(ctx: any, text: string, x: number, y: number, font: string, fill: string, strokeWidth: number) {
  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  
  ctx.strokeStyle = GARIS_TEPI;
  ctx.lineWidth = strokeWidth * 2; // In canvas, stroke goes both inside and outside
  ctx.lineJoin = 'round';
  ctx.strokeText(text, x, y);
  
  ctx.fillStyle = fill;
  ctx.fillText(text, x, y);
}

function renderFrame(ctx: any, nama: string, avatar: any, nomor: number, progress: number) {
  const p = progress;
  ctx.clearRect(0, 0, LEBAR, TINGGI);

  // Background
  if (backgroundPath) {
    const bg = cachedBg;
    const scale = Math.max(LEBAR / bg.width, TINGGI / bg.height);
    const scaledW = bg.width * scale;
    const scaledH = bg.height * scale;
    const dx = (LEBAR - scaledW) / 2;
    const dy = (TINGGI - scaledH) / 2;
    ctx.drawImage(bg, dx, dy, scaledW, scaledH);
    ctx.fillStyle = `rgba(0, 0, 0, ${GELAP})`;
    ctx.fillRect(0, 0, LEBAR, TINGGI);
  } else {
    const gradient = ctx.createLinearGradient(0, 0, 0, TINGGI);
    gradient.addColorStop(0, `rgb(${WARNA_ATAS[0]}, ${WARNA_ATAS[1]}, ${WARNA_ATAS[2]})`);
    gradient.addColorStop(1, `rgb(${WARNA_BAWAH[0]}, ${WARNA_BAWAH[1]}, ${WARNA_BAWAH[2]})`);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, LEBAR, TINGGI);
  }

  // Avatar with scale-in
  const avatarScale = Math.min(1, p * 2);
  const avatarSize = AVATAR * avatarScale;
  const left = PUSAT - (avatarSize / 2);
  const top = AVATAR_ATAS + (AVATAR - avatarSize) / 2;

  ctx.save();
  ctx.globalAlpha = Math.min(1, p * 2.5);
  ctx.beginPath();
  ctx.arc(PUSAT, top + (avatarSize / 2), (avatarSize / 2) + CINCIN, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(PUSAT, top + (avatarSize / 2), avatarSize / 2, 0, Math.PI * 2);
  ctx.clip();
  ctx.drawImage(avatar, left, top, avatarSize, avatarSize);
  ctx.restore();

  // Texts slide up
  const textProgress = Math.max(0, Math.min(1, (p - 0.2) / 0.8));
  const slideY = (1 - textProgress) * 40;

  ctx.save();
  ctx.globalAlpha = textProgress;
  // Atas
  drawTextWithStroke(ctx, KATA_ATAS, PUSAT, Y_ATAS + slideY, `bold ${UKURAN_ATAS}px sans-serif`, '#ffffff', 4);
  // Nama
  let ukuranNama = UKURAN_NAMA;
  ctx.font = `bold ${ukuranNama}px sans-serif`;
  while (ctx.measureText(nama).width > LEBAR - 100 && ukuranNama > 16) {
    ukuranNama -= 2;
    ctx.font = `bold ${ukuranNama}px sans-serif`;
  }
  drawTextWithStroke(ctx, nama, PUSAT, Y_NAMA + slideY, `bold ${ukuranNama}px sans-serif`, '#ffffff', 3);
  // Bawah
  const textBawah = KATA_BAWAH.replace('{nomor}', nomor.toString());
  drawTextWithStroke(ctx, textBawah, PUSAT, Y_BAWAH + slideY, `bold ${UKURAN_BAWAH}px sans-serif`, WARNA_AKSEN, 3);
  ctx.restore();
}

let cachedBg: any = null;

export async function buatKartu(nama: string, avatarBuffer: Buffer | string, nomor: number, namaServer: string): Promise<Buffer> {
  // Load background once
  if (!cachedBg && backgroundPath) {
    try {
      cachedBg = await loadImage(backgroundPath);
    } catch { cachedBg = null; }
  }

  const avatar = await loadImage(avatarBuffer).catch(() => null);

  const encoder = new GIFEncoder(LEBAR, TINGGI);
  encoder.start();
  encoder.setRepeat(0);
  encoder.setDelay(60);
  encoder.setQuality(10);

  const canvas = createCanvas(LEBAR, TINGGI);
  const ctx = canvas.getContext('2d');

  const totalFrames = 30;
  for (let i = 0; i < totalFrames; i++) {
    const progress = i / totalFrames;
    renderFrame(ctx, nama, avatar, nomor, progress);
    encoder.addFrame(ctx as any);
  }

  const staticCanvas = createCanvas(LEBAR, TINGGI);
  const staticCtx = staticCanvas.getContext('2d');
  renderFrame(staticCtx, nama, avatar, nomor, 1.0);
  for (let i = 0; i < 10; i++) {
    encoder.addFrame(staticCtx as any);
  }

  encoder.finish();
  return encoder.out.getData() as Buffer;
}
