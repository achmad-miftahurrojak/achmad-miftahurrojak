import { createCanvas, loadImage, GlobalFonts } from '@napi-rs/canvas';
import { logger } from '@hamin/utils';

export async function buatKartuLevel(
  nama: string,
  fotoUrl: string,
  tingkatNama: string,
  xpSekarang: number,
  batasBawah: number,
  batasAtas: number | null,
  peringkat: number | null,
  lencana: any[],
  catatan: any
): Promise<Buffer> {
  const W = 800;
  const H = 280;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  // ===== BACKGROUND GRADIENT =====
  const bgGrad = ctx.createLinearGradient(0, 0, W, H);
  bgGrad.addColorStop(0, '#1e1f22');
  bgGrad.addColorStop(0.5, '#23252a');
  bgGrad.addColorStop(1, '#1a1b1e');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, W, H);

  // Decorative top accent line
  const accentGrad = ctx.createLinearGradient(0, 0, W, 0);
  accentGrad.addColorStop(0, '#5865F2');
  accentGrad.addColorStop(0.5, '#EB459E');
  accentGrad.addColorStop(1, '#5865F2');
  ctx.fillStyle = accentGrad;
  ctx.fillRect(0, 0, W, 4);

  // Subtle grid pattern
  ctx.strokeStyle = 'rgba(255,255,255,0.02)';
  ctx.lineWidth = 1;
  for (let x = 0; x < W; x += 40) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
    ctx.stroke();
  }
  for (let y = 0; y < H; y += 40) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }

  // ===== AVATAR WITH GLOW & BORDER =====
  const avatarX = 60;
  const avatarY = 60;
  const avatarR = 80;

  // Glow ring behind avatar
  if (peringkat !== null && peringkat <= 3) {
    const glowColors = ['#FEE75C', '#C0C0C0', '#CD7F32'];
    const glowGrad = ctx.createRadialGradient(avatarX + avatarR, avatarY + avatarR, avatarR + 10, avatarX + avatarR, avatarY + avatarR, avatarR + 25);
    glowGrad.addColorStop(0, glowColors[peringkat - 1] + '80');
    glowGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = glowGrad;
    ctx.beginPath();
    ctx.arc(avatarX + avatarR, avatarY + avatarR, avatarR + 25, 0, Math.PI * 2);
    ctx.fill();
  }

  try {
    const avatar = await loadImage(fotoUrl);
    ctx.save();
    ctx.beginPath();
    ctx.arc(avatarX + avatarR, avatarY + avatarR, avatarR, 0, Math.PI * 2, true);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(avatar, avatarX, avatarY, avatarR * 2, avatarR * 2);
    ctx.restore();

    // Avatar border
    ctx.strokeStyle = peringkat && peringkat <= 3 ? ['#FEE75C', '#C0C0C0', '#CD7F32'][peringkat - 1] : '#5865F2';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(avatarX + avatarR, avatarY + avatarR, avatarR, 0, Math.PI * 2);
    ctx.stroke();
  } catch (e) {
    logger.error(e, 'Gagal meload avatar');
    // Fallback avatar placeholder
    ctx.fillStyle = '#3a3d42';
    ctx.beginPath();
    ctx.arc(avatarX + avatarR, avatarY + avatarR, avatarR, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = '60px sans-serif';
    ctx.fillStyle = '#72767d';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(nama.charAt(0).toUpperCase(), avatarX + avatarR, avatarY + avatarR + 10);
  }

  // ===== NAME WITH SHADOW =====
  ctx.font = 'bold 42px sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = 'rgba(0,0,0,0.6)';
  ctx.shadowBlur = 4;
  ctx.shadowOffsetX = 2;
  ctx.shadowOffsetY = 2;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  const maxNameWidth = 480;
  const displayName = ctx.measureText(nama).width > maxNameWidth 
    ? nama.substring(0, Math.floor(nama.length * maxNameWidth / ctx.measureText(nama).width)) + '...' 
    : nama;
  ctx.fillText(displayName, 230, 95);

  // ===== RANK BADGE (Top 3) =====
  if (peringkat !== null && peringkat <= 3) {
    const rankEmojis = ['🥇', '🥈', '🥉'];
    const rankColors = ['#FEE75C', '#C0C0C0', '#CD7F32'];
    ctx.font = '28px sans-serif';
    ctx.fillStyle = rankColors[peringkat - 1];
    ctx.shadowColor = rankColors[peringkat - 1] + '80';
    ctx.shadowBlur = 8;
    ctx.fillText(`${rankEmojis[peringkat - 1]} #${peringkat}`, 230, 135);
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
  } else if (peringkat !== null) {
    ctx.font = '28px sans-serif';
    ctx.fillStyle = '#b9bbbe';
    ctx.fillText(`#${peringkat}`, 230, 135);
  }

  // ===== TIER/LEVEL NAME =====
  ctx.font = 'bold 30px sans-serif';
  ctx.fillStyle = '#5865F2';
  ctx.shadowColor = '#5865F280';
  ctx.shadowBlur = 6;
  ctx.fillText(tingkatNama, 280 + (peringkat ? 50 : 0), 135);
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;

  // ===== PROGRESS BAR WITH GRADIENT =====
  const barX = 230;
  const barY = 175;
  const barW = 520;
  const barH = 34;
  const radius = 17;

  // Background track
  const trackGrad = ctx.createLinearGradient(barX, barY, barX, barY + barH);
  trackGrad.addColorStop(0, '#3a3d42');
  trackGrad.addColorStop(1, '#2b2d31');
  ctx.fillStyle = trackGrad;
  ctx.beginPath();
  ctx.roundRect(barX, barY, barW, barH, radius);
  ctx.fill();

  // Progress fill
  if (batasAtas && batasAtas > batasBawah) {
    const progress = Math.min(Math.max((xpSekarang - batasBawah) / (batasAtas - batasBawah), 0), 1);
    const fillW = Math.max(progress * barW, progress > 0 ? 8 : 0);

    const fillGrad = ctx.createLinearGradient(barX, barY, barX + fillW, barY);
    fillGrad.addColorStop(0, '#5865F2');
    fillGrad.addColorStop(0.5, '#7C8BFF');
    fillGrad.addColorStop(1, '#EB459E');
    ctx.fillStyle = fillGrad;
    ctx.beginPath();
    ctx.roundRect(barX, barY, fillW, barH, radius);
    ctx.fill();

    // Shine overlay on progress
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.beginPath();
    const shineH = barH / 2;
    if (fillW === barW) {
      ctx.roundRect(barX, barY, fillW, shineH, radius);
    } else {
      ctx.moveTo(barX + radius, barY);
      ctx.lineTo(barX + fillW - radius, barY);
      ctx.quadraticCurveTo(barX + fillW, barY, barX + fillW, barY + radius);
      ctx.lineTo(barX + fillW, barY + shineH);
      ctx.lineTo(barX + radius, barY + shineH);
      ctx.quadraticCurveTo(barX, barY + shineH, barX, barY + radius);
      ctx.closePath();
    }
    ctx.fill();
  } else {
    // MAX LEVEL - gold gradient
    const maxGrad = ctx.createLinearGradient(barX, barY, barX + barW, barY);
    maxGrad.addColorStop(0, '#FEE75C');
    maxGrad.addColorStop(0.5, '#FFD700');
    maxGrad.addColorStop(1, '#FFA500');
    ctx.fillStyle = maxGrad;
    ctx.beginPath();
    ctx.roundRect(barX, barY, barW, barH, radius);
    ctx.fill();
  }

  // ===== XP TEXT =====
  ctx.font = 'bold 20px sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = 'rgba(0,0,0,0.5)';
  ctx.shadowBlur = 3;
  ctx.shadowOffsetX = 1;
  ctx.shadowOffsetY = 1;
  const xpText = batasAtas ? `${formatNumber(xpSekarang)} / ${formatNumber(batasAtas)} XP` : `${formatNumber(xpSekarang)} XP (MAX)`;
  ctx.textAlign = 'right';
  ctx.fillText(xpText, W - 40, barY + 24);
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;

  // ===== LANCANA / BADGES =====
  if (lencana.length > 0) {
    const badgeY = 230;
    const badgeSize = 36;
    const badgeGap = 8;
    const startX = 230;
    
    ctx.font = '24px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    lencana.slice(0, 5).forEach((l, i) => {
      const bx = startX + i * (badgeSize + badgeGap);
      const by = badgeY;
      
      // Badge background circle
      const badgeGrad = ctx.createLinearGradient(bx, by - badgeSize/2, bx, by + badgeSize/2);
      badgeGrad.addColorStop(0, '#5865F2');
      badgeGrad.addColorStop(1, '#3a3d42');
      ctx.fillStyle = badgeGrad;
      ctx.beginPath();
      ctx.arc(bx, by, badgeSize / 2, 0, Math.PI * 2);
      ctx.fill();
      
      // Badge border
      ctx.strokeStyle = '#7C8BFF';
      ctx.lineWidth = 2;
      ctx.stroke();
      
      // Emoji
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = 'rgba(0,0,0,0.3)';
      ctx.shadowBlur = 2;
      ctx.fillText(l[1], bx, by + 2);
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
    });
  }

  return canvas.toBuffer('image/png');
}

function formatNumber(num: number): string {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toString();
}
