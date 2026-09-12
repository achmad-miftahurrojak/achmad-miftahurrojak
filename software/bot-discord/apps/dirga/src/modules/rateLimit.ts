const JATAH_USER_PER_JAM = 20;
const JEDA_USER_DETIK = 5;

// In-memory rate limit tracker: userId -> timestamps (unix seconds)
const _usage = new Map<string, number[]>();

function bersihkanUsage() {
  const now = Date.now() / 1000;
  for (const [kunci, arr] of _usage.entries()) {
    const baru = arr.filter(t => now - t < 3600);
    if (baru.length === 0) _usage.delete(kunci);
    else _usage.set(kunci, baru);
  }
}

// Periodic cleanup
if (typeof setInterval === 'function') {
  setInterval(() => void bersihkanUsage(), 10 * 60_000);
}

export function checkRateLimit(userId: string): { allowed: boolean; reason?: string } {
  const now = Date.now() / 1000;
  const raw = _usage.get(userId) || [];
  const jejak = raw.filter(t => now - t < 3600);

  if (jejak.length > 0 && now - jejak[jejak.length - 1] < JEDA_USER_DETIK) {
    return { allowed: false, reason: `sabar dikit, ${JEDA_USER_DETIK} detik sekali aja` };
  }

  if (jejak.length >= JATAH_USER_PER_JAM) {
    const lega = Math.floor((3600 - (now - jejak[0])) / 60) + 1;
    return { allowed: false, reason: `lo kebanyakan nanya jam ini. coba lagi ${lega} menit lagi` };
  }

  jejak.push(now);
  _usage.set(userId, jejak);
  return { allowed: true };
}

export function getUsage(userId: string): number[] {
  const now = Date.now() / 1000;
  return (_usage.get(userId) || []).filter(t => now - t < 3600);
}

export function getRateLimitInfo(userId: string): { remaining: number; nextReset: number | null } {
  const usage = getUsage(userId);
  const remaining = Math.max(0, JATAH_USER_PER_JAM - usage.length);
  const nextReset = usage.length > 0 ? Math.floor(usage[0] + 3600) : null;
  return { remaining, nextReset };
}
