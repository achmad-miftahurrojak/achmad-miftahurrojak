import { Client, TextChannel, EmbedBuilder, Colors } from 'discord.js';
import { logger, CHANNELS } from '@hamin/utils';

// ============================================================
// NEWS MODULE — Julian
// Kirim ke #announcements tiap hari jam 08.00 WIB:
// 1. Hari besar nasional (kalau ada)
// 2. Headline berita terkini dari Tempo & Kompas (RSS)
// ============================================================

// ─── Hari Besar Nasional Indonesia ───────────────────────────
// Format: { bulan, tanggal, nama, keterangan }
const HARI_BESAR = [
  { bulan: 1,  tanggal: 1,  nama: 'Tahun Baru Masehi', keterangan: 'Selamat tahun baru! 🎉' },
  { bulan: 2,  tanggal: 14, nama: 'Hari Valentine', keterangan: 'Semoga semua orang dikelilingi orang yang disayang 💕' },
  { bulan: 3,  tanggal: 8,  nama: 'Hari Perempuan Internasional', keterangan: 'Selamat Hari Perempuan Internasional 🌸' },
  { bulan: 4,  tanggal: 21, nama: 'Hari Kartini', keterangan: 'Habis gelap terbitlah terang 🪔' },
  { bulan: 5,  tanggal: 1,  nama: 'Hari Buruh Internasional', keterangan: 'Selamat Hari Buruh! Semangat buat semua yang kerja keras 💪' },
  { bulan: 5,  tanggal: 2,  nama: 'Hari Pendidikan Nasional', keterangan: 'Tut wuri handayani 📚' },
  { bulan: 5,  tanggal: 20, nama: 'Hari Kebangkitan Nasional', keterangan: 'Bangkit dan terus bergerak maju 🇮🇩' },
  { bulan: 6,  tanggal: 1,  nama: 'Hari Pancasila', keterangan: 'Bhinneka Tunggal Ika 🇮🇩' },
  { bulan: 7,  tanggal: 22, nama: 'Hari Anak Nasional', keterangan: 'Selamat Hari Anak Nasional! Jadilah generasi penerus yang hebat 🌟' },
  { bulan: 8,  tanggal: 17, nama: 'Hari Kemerdekaan RI', keterangan: 'MERDEKA! 🇮🇩🎆 Dirgahayu Republik Indonesia!' },
  { bulan: 9,  tanggal: 28, nama: 'Hari Internet Sehat', keterangan: 'Gunakan internet dengan bijak 💻' },
  { bulan: 10, tanggal: 1,  nama: 'Hari Kesaktian Pancasila', keterangan: 'Pancasila sakti, dasar negara kita 🇮🇩' },
  { bulan: 10, tanggal: 5,  nama: 'Hari TNI', keterangan: 'Terima kasih kepada semua pejuang negeri 🪖' },
  { bulan: 10, tanggal: 28, nama: 'Hari Sumpah Pemuda', keterangan: 'Satu nusa, satu bangsa, satu bahasa — Indonesia 🇮🇩' },
  { bulan: 11, tanggal: 10, nama: 'Hari Pahlawan', keterangan: 'Bersemangat seperti para pahlawan kita yang gagah berani ⚔️' },
  { bulan: 12, tanggal: 22, nama: 'Hari Ibu', keterangan: 'Selamat Hari Ibu! Terima kasih Ibu atas semua kasih sayangmu ❤️' },
  { bulan: 12, tanggal: 25, nama: 'Hari Natal', keterangan: 'Selamat Natal bagi yang merayakan! 🎄' },
  { bulan: 12, tanggal: 31, nama: 'Malam Tahun Baru', keterangan: 'Sebentar lagi tahun baru! Apa resolusi lo? 🎆' },
];

function hariBesarHariIni(): typeof HARI_BESAR[0] | null {
  const now = new Date();
  // WIB = UTC+7
  const wib = new Date(now.getTime() + 7 * 3600_000);
  const bulan = wib.getUTCMonth() + 1;
  const tanggal = wib.getUTCDate();
  return HARI_BESAR.find(h => h.bulan === bulan && h.tanggal === tanggal) ?? null;
}

// ─── Fetch RSS berita ─────────────────────────────────────────

interface Berita {
  judul: string;
  link: string;
  sumber: string;
}

async function fetchRssBerita(url: string, sumber: string, maks = 3): Promise<Berita[]> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (JulianBot/1.0)' },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const xml = await res.text();

    const items: Berita[] = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    let match: RegExpExecArray | null;

    while ((match = itemRegex.exec(xml)) !== null && items.length < maks) {
      const block = match[1];
      const judul = block.match(/<title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/)?.[1]?.trim() ?? '';
      const link = block.match(/<link>(.*?)<\/link>/)?.[1]?.trim()
        ?? block.match(/<guid[^>]*>(.*?)<\/guid>/)?.[1]?.trim() ?? '';

      if (judul && link) items.push({ judul, link, sumber });
    }

    return items;
  } catch (err: any) {
    logger.warn(`[news] gagal fetch RSS ${sumber}: ${String(err).slice(0, 150)}`);
    return [];
  }
}

async function fetchBeritaTerkini(): Promise<Berita[]> {
  const [tempo, kompas] = await Promise.all([
    fetchRssBerita('https://www.tempo.co/rss/nasional', 'Tempo', 3),
    fetchRssBerita('https://rss.kompas.com/nasional/', 'Kompas', 3),
  ]);

  // Gabung & batasi 5 berita total
  return [...tempo, ...kompas].slice(0, 5);
}

// ─── Kirim ke #announcements ──────────────────────────────────

export async function kirimBeritaHarian(client: Client) {
  try {
    const guild = client.guilds.cache.first();
    if (!guild) return;

    const annCh = guild.channels.cache.get(CHANNELS.announcements) as TextChannel | undefined;
    if (!annCh) {
      logger.warn('[news] channel #announcements tidak ditemukan');
      return;
    }

    const hariBesar = hariBesarHariIni();
    const beritaList = await fetchBeritaTerkini();

    const embeds: EmbedBuilder[] = [];

    // Embed hari besar (kalau ada)
    if (hariBesar) {
      const embedHariBesar = new EmbedBuilder()
        .setTitle(`🗓️ Hari Ini: ${hariBesar.nama}`)
        .setDescription(hariBesar.keterangan)
        .setColor(Colors.Gold)
        .setTimestamp();
      embeds.push(embedHariBesar);
    }

    // Embed berita terkini
    if (beritaList.length > 0) {
      const beritaBaris = beritaList
        .map((b, i) => `**${i + 1}. [${b.judul}](${b.link})**\n*Sumber: ${b.sumber}*`)
        .join('\n\n');

      const embedBerita = new EmbedBuilder()
        .setTitle('📰 Berita Indonesia Hari Ini')
        .setDescription(beritaBaris)
        .setColor(Colors.Blurple)
        .setFooter({ text: 'Sumber: Tempo & Kompas · Hanya dari media kredibel' })
        .setTimestamp();
      embeds.push(embedBerita);
    }

    if (embeds.length === 0) {
      logger.info('[news] tidak ada hari besar maupun berita hari ini');
      return;
    }

    await annCh.send({ embeds });
    logger.info(`[news] berita harian terkirim (${embeds.length} embed)`);
  } catch (err: any) {
    logger.error({ err: String(err).slice(0, 300) }, '[news] error kirimBeritaHarian');
  }
}

// ─── Jadwalkan tiap hari jam 08.00 WIB ───────────────────────

export function startNewsLoop(client: Client) {
  function jadwalkanBerikutnya() {
    const now = new Date();
    // WIB = UTC+7 → 08:00 WIB = 01:00 UTC
    const targetUTC = new Date();
    targetUTC.setUTCHours(1, 0, 0, 0); // 01:00 UTC = 08:00 WIB

    if (now.getTime() >= targetUTC.getTime()) {
      // Sudah lewat jam 08 WIB hari ini, jadwalkan ke besok
      targetUTC.setUTCDate(targetUTC.getUTCDate() + 1);
    }

    const selisihMs = targetUTC.getTime() - now.getTime();
    logger.info(`[news] berita harian dijadwalkan ${Math.round(selisihMs / 60_000)} menit lagi`);

    setTimeout(async () => {
      await kirimBeritaHarian(client);
      // Setelah kirim, jadwalkan ke hari berikutnya
      jadwalkanBerikutnya();
    }, selisihMs);
  }

  jadwalkanBerikutnya();
}
