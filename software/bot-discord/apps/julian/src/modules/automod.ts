import { Message, TextChannel, EmbedBuilder, Colors, GuildMember, PermissionFlagsBits, Client } from 'discord.js';
import { logger, CHANNELS } from '@hamin/utils';

// ============================================================
// AUTOMOD — filter kata kasar, spam, link undangan, dll.
// Terintegrasi dengan database untuk update kata kasar
// dari Dirga secara berkala.
// ============================================================

export const AUTOMOD_CONFIG = {
  AKTIF: true,
  BEBAS_CHANNELS: [] as string[],
  FILTER_KATA: true,
  BLOKIR_UNDANGAN: true,
  ANTI_SPAM: true,
  SPAM_JUMLAH: 5,
  SPAM_DETIK: 7,
  AUTO_SLOWMODE: true,
  SLOWMODE_PEMICU: 3,
  SLOWMODE_JENDELA: 60,
  SLOWMODE_ORANG_BEDA: 2,
  SLOWMODE_DETIK: 15,
  SLOWMODE_LAMA_MENIT: 10,
  BATAS_KAPITAL: true,
  KAPITAL_PERSEN: 70,
  KAPITAL_MINIMAL: 12,
  MAX_MENTION: 5,
  STRIKE_SEBELUM_TIMEOUT: 3,
  TIMEOUT_OTOMATIS_MENIT: 10,

  // ─── Daftar kata kasar ─────────────────────────────────────────
  // KATA_BERAT → hapus pesan + hitung strike → timeout otomatis
  KATA_BERAT: [
    // ── Indonesia dasar ──
    'kontol', 'memek', 'pepek', 'peler', 'titit', 'jembut', 'puki', 'pukimak',
    'ngentot', 'ngentod', 'entot', 'kentot', 'ngewe', 'sange', 'coli', 'colmek',
    'peju', 'pejuh', 'bokep', 'bangsat', 'bajingan', 'lonte', 'sundal', 'pelacur',
    'brengsek', 'bajing', 'bejat', 'biadab', 'keparat',

    // ── Jawa ──
    'jancok', 'jancuk', 'asu', 'asw', 'matamu', 'matane', 'diamput', 'diancok',
    'dancok', 'dancuk', 'jamput', 'raimu', 'raiso', 'tempik', 'ndasmu', 'ndas',
    'mamakmu', 'mbahemu', 'kontolmu', 'picek', 'cukimai', 'lambemu',

    // ── Sunda ──
    'kehed', 'sia', 'maneh', 'lonte', 'hedog', 'belegug', 'bejad', 'kunyuk',
    'sampean', 'anjir', 'anjay',

    // ── Betawi / Melayu ──
    'bangsat', 'bajingan', 'taik', 'tai', 'bangke', 'bangkai', 'kimak', 'babi',

    // ── Batak / Sumatera ──
    'horas bah' /* bukan kasar, tapi dipakai ironis/hinaan konteks */,
    'sial kau', 'sialan kau', 'bodoh kau',

    // ── Manado / Sulawesi ──
    'baku', 'palui', 'cocote',

    // ── Sumpah / vulgar berat Indonesia ──
    'anjing lo', 'babi lo', 'tolol lo', 'monyet lo', 'goblok lo',

    // ── Inggris berat ──
    'fuck', 'fucker', 'fucking', 'motherfucker', 'motherfucking',
    'shit', 'bullshit', 'shithead',
    'bitch', 'son of a bitch', 'bitches',
    'cunt', 'cunts',
    'asshole', 'assholes',
    'nigger', 'nigga',
    'faggot', 'fag',
    'whore', 'slut',
    'bastard', 'bastards',
    'dick', 'cock', 'pussy', 'boobs',
    'rape', 'raped',
    'kill yourself', 'kys',

    // ── Inggris kontekstual kasar ──
    'go to hell', 'gtfo',
  ],

  // KATA_RINGAN → hapus pesan, tidak hitung strike, tidak timeout
  KATA_RINGAN: [
    // ── Indonesia ringan ──
    'tolol', 'goblok', 'goblog', 'bego', 'bodoh', 'idiot', 'dungu', 'kampret',
    'monyet', 'setan', 'sialan', 'anjir', 'njir', 'anjay', 'bangsad', 'cok', 'cuk',
    'loleng', 'goblog', 'dongo', 'brengsek', 'kampungan',
    'alay', 'lebay', 'lebai', 'receh', 'norak', 'kampret',
    'jijik lo', 'dasar lo', 'kurang ajar',

    // ── Jawa ringan ──
    'goblok', 'asem', 'jangkrik', 'semprul', 'mbuh', 'ra mutu',

    // ── Inggris ringan ──
    'damn', 'dammit', 'crap', 'wtf', 'stfu', 'idiot', 'stupid', 'dumb',
    'moron', 'loser', 'jerk', 'jackass', 'prick',
    'shut up', 'shutup', 'shut the fuck up',
    'ffs', 'fml', 'omfg',
  ],
};

// Dinamis kata kasar yang bisa di-update via Dirga
let KATA_TAMBAHAN_BERAT: string[] = [];
let KATA_TAMBAHAN_RINGAN: string[] = [];

/** Dipanggil oleh Dirga saat update kata kasar dari AI */
export function tambahKataKasar(berat: string[], ringan: string[]) {
  const beratBaru = berat.filter(k => !AUTOMOD_CONFIG.KATA_BERAT.includes(k) && !KATA_TAMBAHAN_BERAT.includes(k));
  const ringanBaru = ringan.filter(k => !AUTOMOD_CONFIG.KATA_RINGAN.includes(k) && !KATA_TAMBAHAN_RINGAN.includes(k));
  KATA_TAMBAHAN_BERAT.push(...beratBaru);
  KATA_TAMBAHAN_RINGAN.push(...ringanBaru);
  logger.info(`[automod] +${beratBaru.length} kata berat, +${ringanBaru.length} kata ringan dari update Dirga`);
}

export function getKataKasar() {
  return {
    berat: [...AUTOMOD_CONFIG.KATA_BERAT, ...KATA_TAMBAHAN_BERAT],
    ringan: [...AUTOMOD_CONFIG.KATA_RINGAN, ...KATA_TAMBAHAN_RINGAN],
  };
}

const TEGURAN = {
  kata: [
    'eh jaga mulut dikit, pesan lo gua hapus ya',
    'kata-kata lo kena filter. santai aja ngomongnya bro',
    'pesan lo dihapus, ada kata yang ga boleh di server ini. sekali lagi bisa timeout'
  ],
  kata_ringan: [
    'santai dikit ngomongnya, pesan lo gua hapus',
    'yang ini kena filter. tenang, ga gua catat sebagai pelanggaran kok'
  ],
  undangan: [
    'jangan promosi server lain di sini ya, pesan dihapus',
    'link undangan server lain gua hapus, maaf ya'
  ],
  spam: [
    'pelan-pelan ngetiknya, kecepetan itu',
    'santai bro, chatnya kebanyakan dalam sedetik'
  ],
  kapital: [
    'ga usah caps lock semua, kaya lagi teriak',
    'kecilin huruf lo dikit, berisik bacanya'
  ],
  mention: [
    'kebanyakan nge-tag orang sekaligus, jangan gitu ya',
    'jangan mention rame-rame, ganggu yang lain'
  ]
};

const _strike = new Map<string, number[]>();
const _riwayat_chat = new Map<string, number[]>();
const _panas = new Map<string, { time: number, authorId: string }[]>();
const _slowmode_bot = new Map<string, number>();

function bersihkanAutomodMaps() {
  const sekarang = Date.now();
  for (const [kunci, arr] of _strike.entries()) {
    const baru = arr.filter(t => sekarang - t < 10 * 60_000);
    if (baru.length === 0) _strike.delete(kunci);
    else _strike.set(kunci, baru);
  }
  for (const [kunci, arr] of _riwayat_chat.entries()) {
    const baru = arr.filter(t => sekarang - t < 10_000);
    if (baru.length === 0) _riwayat_chat.delete(kunci);
    else _riwayat_chat.set(kunci, baru);
  }
  for (const [kunci, arr] of _panas.entries()) {
    const baru = arr.filter(t => sekarang - t.time < 70_000);
    if (baru.length === 0) _panas.delete(kunci);
    else _panas.set(kunci, baru);
  }
}

// ──────────────────────────────────────────────────────────────
// Fungsi normalisasi teks — deteksi leetspeak & variasi karakter
// ──────────────────────────────────────────────────────────────

function _bersih(teks: string): string {
  const tukar: Record<string, string> = {
    '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't',
    '@': 'a', '$': 's', '!': 'i', '|': 'i', '+': 't', '(': 'c',
    ')': 'o', '8': 'b', '9': 'g', 'q': 'g', 'ph': 'f', 'vv': 'w',
    'ck': 'k', 'xx': 'x'
  };
  let hasil = teks.toLowerCase()
    // hapus karakter berulang (aaanjiiing → anjing)
    .replace(/(.)\1{2,}/g, '$1')
    // hapus tanda baca di tengah kata
    .replace(/[_\-.*,]/g, '');
  for (const [a, b] of Object.entries(tukar)) {
    hasil = hasil.split(a).join(b);
  }
  return hasil;
}

function _kebal(member: GuildMember | null, channel: TextChannel): boolean {
  if (!member) return true;
  if (AUTOMOD_CONFIG.BEBAS_CHANNELS.includes(channel.id)) return true;
  return member.permissions.has(PermissionFlagsBits.ManageMessages) ||
    member.permissions.has(PermissionFlagsBits.Administrator);
}

function _cek_pelanggaran(pesan: Message): keyof typeof TEGURAN | null {
  const isi = pesan.content;

  if (AUTOMOD_CONFIG.FILTER_KATA) {
    const polos = _bersih(isi);
    const { berat, ringan } = getKataKasar();

    // Cek kata berat
    const polaBerat = berat.some(k => {
      const escaped = k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return new RegExp(`(?<![a-z])${escaped}[a-z]{0,3}(?![a-z])`, 'i').test(polos);
    });
    if (polaBerat) return 'kata';

    // Cek kata ringan
    const polaRingan = ringan.some(k => {
      const escaped = k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return new RegExp(`(?<![a-z])${escaped}[a-z]{0,2}(?![a-z])`, 'i').test(polos);
    });
    if (polaRingan) return 'kata_ringan';
  }

  if (AUTOMOD_CONFIG.BLOKIR_UNDANGAN) {
    const polos = isi.toLowerCase().replace(/ /g, '');
    if (polos.includes('discord.gg/') || polos.includes('discord.com/invite')) {
      return 'undangan';
    }
  }

  if (AUTOMOD_CONFIG.MAX_MENTION && pesan.mentions.users.size > AUTOMOD_CONFIG.MAX_MENTION) {
    return 'mention';
  }

  if (AUTOMOD_CONFIG.BATAS_KAPITAL && isi.length >= AUTOMOD_CONFIG.KAPITAL_MINIMAL) {
    const huruf = isi.match(/[a-zA-Z]/g);
    if (huruf) {
      const upper = huruf.filter(c => c === c.toUpperCase()).length;
      const persen = (upper / huruf.length) * 100;
      if (persen >= AUTOMOD_CONFIG.KAPITAL_PERSEN) return 'kapital';
    }
  }

  if (AUTOMOD_CONFIG.ANTI_SPAM) {
    const sekarang = Date.now();
    let jejak = _riwayat_chat.get(pesan.author.id) || [];
    jejak = jejak.filter(w => sekarang - w < AUTOMOD_CONFIG.SPAM_DETIK * 1000);
    jejak.push(sekarang);
    _riwayat_chat.set(pesan.author.id, jejak);
    if (jejak.length >= AUTOMOD_CONFIG.SPAM_JUMLAH) {
      _riwayat_chat.set(pesan.author.id, []);
      return 'spam';
    }
  }

  return null;
}

export async function processAutomod(message: Message) {
  if (!AUTOMOD_CONFIG.AKTIF || message.author.bot || !message.guild || !message.member) return;

  const channel = message.channel;
  if (!(channel instanceof TextChannel)) return;
  if (_kebal(message.member, channel)) return;

  const jenis = _cek_pelanggaran(message);
  if (!jenis) return;

  try {
    if (message.deletable) await message.delete();
  } catch { /* abaikan */ }

  const pilihanTeguran = TEGURAN[jenis];
  const teguran = pilihanTeguran[Math.floor(Math.random() * pilihanTeguran.length)];

  try {
    await message.author.send(teguran);
  } catch {
    try {
      const msg = await channel.send(`${message.author} ${teguran}`);
      setTimeout(() => msg.delete().catch(() => {}), 8000);
    } catch { /* abaikan */ }
  }

  if (jenis === 'spam' && AUTOMOD_CONFIG.AUTO_SLOWMODE) {
    await coba_slowmode(message, channel);
  }

  if (jenis === 'kata_ringan') {
    await kirim_log(
      message,
      '🟡 Automod: kata ringan',
      `Pesan ${message.author} dihapus di ${channel}\nGa dihitung sebagai pelanggaran.`,
      Colors.LightGrey
    );
    return;
  }

  const sekarang = Date.now();
  let catat = _strike.get(message.author.id) || [];
  catat = catat.filter(w => sekarang - w < 10 * 60 * 1000);
  catat.push(sekarang);
  _strike.set(message.author.id, catat);

  await kirim_log(
    message,
    `🔴 Automod: ${jenis}`,
    `Pesan ${message.author} dihapus di ${channel}\nPelanggaran ke-**${catat.length}** dalam 10 menit terakhir.`,
    Colors.Orange
  );

  if (catat.length >= AUTOMOD_CONFIG.STRIKE_SEBELUM_TIMEOUT) {
    _strike.set(message.author.id, []);
    try {
      if (message.member.moderatable) {
        await message.member.timeout(
          AUTOMOD_CONFIG.TIMEOUT_OTOMATIS_MENIT * 60 * 1000,
          `Automod: ${jenis} berulang`
        );
        await message.author
          .send(`lo kena timeout ${AUTOMOD_CONFIG.TIMEOUT_OTOMATIS_MENIT} menit, udah ${AUTOMOD_CONFIG.STRIKE_SEBELUM_TIMEOUT}x kena filter. tenangin diri dulu ya`)
          .catch(() => {});
        await kirim_log(
          message,
          '🚫 Automod: timeout otomatis',
          `${message.author} kena timeout ${AUTOMOD_CONFIG.TIMEOUT_OTOMATIS_MENIT} menit.`,
          Colors.Red
        );
      }
    } catch (e) {
      logger.error(e, '[automod] ga bisa timeout, cek posisi role bot');
    }
  }
}

async function coba_slowmode(pesan: Message, channel: TextChannel) {
  const sekarang = Date.now();
  let jejak = _panas.get(channel.id) || [];
  jejak = jejak.filter(j => sekarang - j.time < AUTOMOD_CONFIG.SLOWMODE_JENDELA * 1000);
  jejak.push({ time: sekarang, authorId: pesan.author.id });
  _panas.set(channel.id, jejak);

  if (jejak.length < AUTOMOD_CONFIG.SLOWMODE_PEMICU) return;

  const orangBeda = new Set(jejak.map(j => j.authorId)).size;
  if (orangBeda < AUTOMOD_CONFIG.SLOWMODE_ORANG_BEDA) return;
  if (channel.rateLimitPerUser >= AUTOMOD_CONFIG.SLOWMODE_DETIK) return;

  try {
    await channel.setRateLimitPerUser(AUTOMOD_CONFIG.SLOWMODE_DETIK, 'Automod: channel lagi rame banget');
    _panas.set(channel.id, []);
    _slowmode_bot.set(channel.id, sekarang);

    const msg = await channel.send(
      `Rame banget di sini. Gua pasang jeda **${AUTOMOD_CONFIG.SLOWMODE_DETIK} detik** biar kebaca. Kebuka sendiri ${AUTOMOD_CONFIG.SLOWMODE_LAMA_MENIT} menit lagi.`
    );
    setTimeout(() => msg.delete().catch(() => {}), 60000);

    await kirim_log(
      pesan,
      '🟠 Automod: slowmode otomatis',
      `${channel} diset ${AUTOMOD_CONFIG.SLOWMODE_DETIK} detik karena ${jejak.length} kejadian spam dari ${orangBeda} orang berbeda.`,
      Colors.Orange
    );
  } catch (error) {
    logger.error(error, '[automod] mau pasang slowmode gagal');
  }
}

export async function lepas_slowmode_task(client: Client) {
  const sekarang = Date.now();
  for (const [ch_id, kapan] of _slowmode_bot.entries()) {
    if (sekarang - kapan < AUTOMOD_CONFIG.SLOWMODE_LAMA_MENIT * 60 * 1000) continue;

    _slowmode_bot.delete(ch_id);
    const channel = client.channels.cache.get(ch_id) as TextChannel;
    if (!channel || channel.rateLimitPerUser !== AUTOMOD_CONFIG.SLOWMODE_DETIK) continue;

    try {
      await channel.setRateLimitPerUser(0, 'Automod: channelnya udah adem');
      if (channel.guild) {
        const dummyMsg = { guild: channel.guild, author: client.user } as any;
        await kirim_log(dummyMsg, '🟢 Automod: slowmode dilepas', `${channel} balik normal.`, Colors.Green);
      }
    } catch { /* abaikan */ }
  }
}

async function kirim_log(message: Message, title: string, desc: string, color: number) {
  const logChannelId = process.env.LOG_CHANNEL_ID || CHANNELS.logServer;
  if (!logChannelId || !message.guild) return;

  const channel = message.guild.channels.cache.get(logChannelId) as TextChannel;
  if (!channel) return;

  const embed = new EmbedBuilder()
    .setTitle(title)
    .setColor(color)
    .setDescription(desc)
    .setTimestamp();

  await channel.send({ embeds: [embed] }).catch(() => {});
}

export function startAutomodTasks(client: Client) {
  // Lepas slowmode tiap 1 menit
  setInterval(() => {
    lepas_slowmode_task(client).catch(e => logger.error(e, '[automod] error lepas_slowmode_task'));
  }, 60_000);
  // Bersihkan Maps tiap 2 menit
  setInterval(() => void bersihkanAutomodMaps(), 2 * 60_000);
}
