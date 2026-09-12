import {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ChatInputCommandInteraction,
  REST,
  Routes,
  SlashCommandBuilder,
  ActivityType
} from 'discord.js';
import {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  VoiceConnectionStatus,
  entersState,
  getVoiceConnection,
  StreamType
} from '@discordjs/voice';
import { spawn } from 'child_process';
import { logger } from '@hamin/utils';
import { CHANNELS, commandChannelMessage, isCommandAllowed } from '@hamin/utils';

// ============================================================
// KEVIN — lofi radio 24/7
// Primary: Radio HTTP (SomaFM Groove Salad) — tidak perlu yt-dlp, paling stable
// Optional: YouTube live stream via yt-dlp (kalau KEVIN_YT_URL diisi)
// ============================================================

const TOKEN = process.env.KEVIN_TOKEN;
const CHANNEL_STUDIO_ID = process.env.KEVIN_CHANNEL_STUDIO_ID || CHANNELS.studyVoice;

// Radio HTTP fallback — reliable 24/7, tidak perlu yt-dlp
const RADIO_URLS = [
  process.env.KEVIN_RADIO_URL || 'http://ice1.somafm.com/groovesalad-128-mp3',
  'http://ice2.somafm.com/groovesalad-128-mp3',  // mirror ke-2
  'http://ice1.somafm.com/lounge-128-mp3',        // SomaFM Lounge fallback
];

// YouTube live (opsional — isi KEVIN_YT_URL di .env)
// Contoh: https://www.youtube.com/watch?v=jfKfPfyJRdk (LoFi Girl)
// Contoh lain: https://www.youtube.com/watch?v=lCOF9LN_Zxs (Chillhop)
const LOFI_YT_URL = process.env.KEVIN_YT_URL || '';

let VOLUME = parseFloat(process.env.KEVIN_VOLUME || '0.4');
const GUILD_ID = process.env.KEVIN_GUILD_ID;

const WATCHDOG_DETIK = 30;
const YT_RENEW_JAM = 4;

const ffmpegPath: string = require('ffmpeg-static');
const ytdlp = process.env.KEVIN_YT_URL ? require('youtube-dl-exec') : null;

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates]
});

const CHANNEL_RULES = {
  play: [CHANNELS.study], stop: [CHANNELS.study], lofi: [CHANNELS.study],
  settings: [CHANNELS.study], help: [CHANNELS.study]
} as const;

const player = createAudioPlayer();
let streamAktif = true;
let sedangReconnect = false;
let idleSejak: number | null = null;
let radioIdx = 0; // indeks URL radio saat ini

player.on('error', (err) => {
  logger.error({ err: err.message }, '[kevin] audio player error');
});

player.on(AudioPlayerStatus.Idle, () => {
  if (idleSejak === null) {
    idleSejak = Date.now();
    logger.info('[kevin] player idle, watchdog siap reconnect...');
  }
});

player.on(AudioPlayerStatus.Playing, () => {
  idleSejak = null;
  logger.info('[kevin] ▶ audio sedang diputar');
});

function pilihGuild() {
  if (GUILD_ID) return client.guilds.cache.get(GUILD_ID) ?? null;
  return client.guilds.cache.first() ?? null;
}

// ============================================================
// Ambil direct audio URL dari YouTube live via yt-dlp
// ============================================================

async function ambilUrlYoutube(ytUrl: string): Promise<string> {
  if (!ytdlp) throw new Error('yt-dlp tidak tersedia (KEVIN_YT_URL tidak diisi)');
  logger.info(`[kevin] ambil URL live stream dari yt-dlp: ${ytUrl}`);
  const info = await ytdlp(ytUrl, {
    format: '91/bestaudio[protocol^=m3u8]/bestaudio/best',
    quiet: true,
    noWarnings: true,
    dumpSingleJson: true,
    noCheckCertificates: true,
    preferFreeFormats: true,
  });

  const entri = Array.isArray(info?.entries) ? info.entries[0] : info;
  if (!entri?.url) throw new Error('[kevin] yt-dlp ga dapat URL dari live stream');

  logger.info(`[kevin] URL live stream berhasil diambil (format: ${entri.ext ?? '?'})`);
  return entri.url as string;
}

// ============================================================
// Buat audio resource via ffmpeg subprocess
// Mendukung HLS (m3u8) dan HTTP stream langsung
// ============================================================

function buatResourceDariUrl(url: string, isHttp = false) {
  const baseArgs = [
    '-reconnect', '1',
    '-reconnect_streamed', '1',
    '-reconnect_delay_max', '5',
    '-thread_queue_size', '4096',
  ];

  // Untuk HTTP radio langsung, tambahkan -re (real-time) agar lebih stable
  if (isHttp) {
    baseArgs.push('-re');
  }

  const args = [
    ...baseArgs,
    '-i', url,
    '-vn',
    '-ar', '48000',
    '-ac', '2',
    '-f', 's16le',
    '-loglevel', 'error',
    'pipe:1'
  ];

  const ffmpegProcess = spawn(ffmpegPath, args, {
    stdio: ['ignore', 'pipe', 'ignore']
  });

  ffmpegProcess.on('error', (err) => {
    logger.error({ err: err.message }, '[kevin] ffmpeg subprocess error');
  });

  ffmpegProcess.on('close', (code) => {
    if (code !== 0 && code !== null) {
      logger.warn(`[kevin] ffmpeg subprocess ditutup dengan kode ${code}`);
    }
  });

  const resource = createAudioResource(ffmpegProcess.stdout!, {
    inputType: StreamType.Raw,
    inlineVolume: true
  });

  resource.volume?.setVolume(VOLUME);
  return resource;
}

// ============================================================
// Stream utama — coba YouTube live dulu, fallback ke radio HTTP
// ============================================================

async function mulaiStream(): Promise<boolean> {
  player.stop();
  await new Promise((r) => setTimeout(r, 800));

  // Radio HTTP — prioritas karena lebih stable untuk 24/7
  for (let i = 0; i < RADIO_URLS.length; i++) {
    const urlIdx = (radioIdx + i) % RADIO_URLS.length;
    const radioUrl = RADIO_URLS[urlIdx];
    try {
      const resource = buatResourceDariUrl(radioUrl, true);
      player.play(resource);
      radioIdx = urlIdx;
      logger.info(`[kevin] ✅ streaming radio HTTP: ${radioUrl}`);
      return true;
    } catch (err: any) {
      logger.warn({ err: String(err).slice(0, 150) }, `[kevin] radio ${radioUrl} gagal, coba berikutnya...`);
    }
  }

  // YouTube live fallback (opsional)
  if (LOFI_YT_URL && ytdlp) {
    try {
      const ytAudioUrl = await ambilUrlYoutube(LOFI_YT_URL);
      const isHls = ytAudioUrl.includes('.m3u8') || ytAudioUrl.includes('m3u8');
      const resource = buatResourceDariUrl(ytAudioUrl, !isHls);
      player.play(resource);
      logger.info('[kevin] ✅ streaming YouTube berjalan');
      return true;
    } catch (err: any) {
      logger.warn({ err: String(err).slice(0, 200) }, '[kevin] YouTube gagal, semua sumber stream habis.');
    }
  }

  logger.error('[kevin] semua sumber stream gagal');
  return false;
}

// ============================================================
// Join voice + subscribe player ke connection
// ============================================================

async function joinDanPutar(guildId: string | null | undefined): Promise<boolean> {
  try {
    const guild = guildId ? client.guilds.cache.get(guildId) : pilihGuild();
    if (!guild) {
      logger.info('[kevin] guild belum ada di cache');
      return false;
    }

    const channel = guild.channels.cache.get(CHANNEL_STUDIO_ID);
    if (!channel || !channel.isVoiceBased()) {
      logger.warn(`[kevin] channel ID ${CHANNEL_STUDIO_ID} ga ketemu atau bukan voice — cek KEVIN_CHANNEL_STUDIO_ID di .env`);
      return false;
    }

    // Kalau sudah ada koneksi & Ready, langsung stream
    const existingConn = getVoiceConnection(guild.id);
    if (existingConn && existingConn.state.status === VoiceConnectionStatus.Ready) {
      existingConn.subscribe(player);
      return await mulaiStream();
    }

    // Destroy koneksi lama kalau ada
    if (existingConn && existingConn.state.status !== VoiceConnectionStatus.Destroyed) {
      existingConn.destroy();
      await new Promise(r => setTimeout(r, 1000));
    }

    const connection = joinVoiceChannel({
      channelId: channel.id,
      guildId: guild.id,
      adapterCreator: guild.voiceAdapterCreator as any,
      selfDeaf: true
    });

    try {
      await entersState(connection, VoiceConnectionStatus.Ready, 25_000);
    } catch (err: any) {
      logger.error(
        { err: String(err).slice(0, 150), status: connection.state.status },
        `[kevin] koneksi voice timeout (channel ${channel.id})`
      );
      if (connection.state.status !== VoiceConnectionStatus.Destroyed) connection.destroy();
      return false;
    }

    connection.on(VoiceConnectionStatus.Disconnected, async () => {
      try {
        await Promise.race([
          entersState(connection, VoiceConnectionStatus.Signalling, 5_000),
          entersState(connection, VoiceConnectionStatus.Connecting, 5_000)
        ]);
      } catch {
        logger.warn('[kevin] koneksi dropped, watchdog akan reconnect');
        if (connection.state.status !== VoiceConnectionStatus.Destroyed) connection.destroy();
      }
    });

    connection.subscribe(player);
    return await mulaiStream();
  } catch (err: any) {
    logger.error({ err: String(err).slice(0, 300) }, '[kevin] gagal joinDanPutar');
    return false;
  }
}

// ============================================================
// Watchdog — polling tiap 30 detik
// ============================================================

async function watchdog() {
  logger.info('[kevin] watchdog aktif (interval 30 detik)');

  setInterval(async () => {
    if (!streamAktif || sedangReconnect || !client.isReady()) return;

    try {
      const guild = pilihGuild();
      if (!guild) return;

      const connection = getVoiceConnection(guild.id);
      const isPlaying = player.state.status === AudioPlayerStatus.Playing;
      const isConnected = connection?.state.status === VoiceConnectionStatus.Ready;
      const idleTooLong = idleSejak !== null && (Date.now() - idleSejak) > 15_000;
      const perluReconnect = !isConnected || !isPlaying || idleTooLong;

      if (perluReconnect) {
        sedangReconnect = true;
        logger.info(`[kevin] watchdog: perlu reconnect (connected=${isConnected}, playing=${isPlaying}, idleTooLong=${idleTooLong})`);

        if (connection && connection.state.status !== VoiceConnectionStatus.Destroyed) {
          connection.destroy();
          await new Promise(r => setTimeout(r, 1500));
        }

        const ok = await joinDanPutar(guild.id);
        sedangReconnect = false;
        if (ok) {
          logger.info('[kevin] watchdog: reconnect berhasil ✅');
          idleSejak = null;
        } else {
          logger.warn('[kevin] watchdog: reconnect gagal, coba lagi di iterasi berikutnya');
        }
      }
    } catch (err: any) {
      logger.error({ err: String(err).slice(0, 300) }, '[kevin] watchdog error');
      sedangReconnect = false;
    }
  }, WATCHDOG_DETIK * 1000);
}

// ============================================================
// Renew URL YouTube berkala (live stream URL bisa expire)
// ============================================================

async function renewYtLoop() {
  if (!LOFI_YT_URL || !ytdlp) return; // skip kalau tidak pakai YouTube
  setInterval(async () => {
    if (!streamAktif || !client.isReady() || sedangReconnect) return;
    logger.info('[kevin] renew URL YouTube secara berkala...');
    sedangReconnect = true;
    try {
      const guild = pilihGuild();
      if (guild) {
        const connection = getVoiceConnection(guild.id);
        if (connection && connection.state.status === VoiceConnectionStatus.Ready) {
          await mulaiStream();
          logger.info('[kevin] renew stream berhasil');
        }
      }
    } catch (err: any) {
      logger.error({ err: String(err).slice(0, 300) }, '[kevin] renew error');
    } finally {
      sedangReconnect = false;
    }
  }, YT_RENEW_JAM * 3_600_000);
}

// ============================================================
// Status bot (casual)
// ============================================================

const STATUS_LIST = [
  '🎵 nemenin lo nugas',
  '☁️ lofi 24/7 — santai dulu',
  '🎧 temen setia lo begadang',
  '🌊 vibes lofi nonstop',
  '📚 beats buat fokus & relax',
  '🌙 masih nyala buat lo'
];

function mulaiStatus() {
  let idx = 0;
  setInterval(() => {
    if (!client.user) return;
    const tulisan = STATUS_LIST[idx % STATUS_LIST.length];
    idx++;
    try {
      client.user.setActivity({ name: tulisan, type: ActivityType.Custom });
    } catch { /* abaikan */ }
  }, 15_000);
}

// ============================================================
// Admin check helper
// ============================================================

function cekAdmin(inter: ChatInputCommandInteraction): boolean {
  if (!inter.inGuild()) return false;
  const member = inter.member as any;
  return !!member?.permissions?.has?.('ManageGuild');
}

async function balasAdmin(inter: ChatInputCommandInteraction): Promise<boolean> {
  if (!cekAdmin(inter)) {
    await inter.reply({
      content: 'Lo ga punya izin (harus Admin) buat pakai perintah ini.',
      ephemeral: true
    });
    return false;
  }
  return true;
}

// ============================================================
// Event: ready
// ============================================================

client.once('ready', async () => {
  logger.info(`[kevin] ${client.user?.tag} online 🎵`);
  mulaiStatus();

  const guild = pilihGuild();
  const ok = await joinDanPutar(guild?.id);

  if (ok) {
    logger.info('[kevin] ✅ stream berjalan otomatis saat startup');
  } else {
    logger.warn('[kevin] startup stream gagal, watchdog akan ambil alih dalam 30 detik');
  }

  void watchdog();
  void renewYtLoop();
});

// ============================================================
// Slash commands handler
// ============================================================

client.on('interactionCreate', async (inter) => {
  if (!inter.isChatInputCommand()) return;
  if (!isCommandAllowed(inter.commandName, inter.channelId, CHANNEL_RULES)) {
    await inter.reply({ content: commandChannelMessage(inter.commandName, CHANNEL_RULES), ephemeral: true });
    return;
  }

  try {
    switch (inter.commandName) {
      case 'play': {
        if (!(await balasAdmin(inter))) return;
        await inter.deferReply({ ephemeral: true });
        streamAktif = true;
        idleSejak = null;
        sedangReconnect = false;
        const ok = await joinDanPutar(inter.guildId);
        if (ok) {
          await inter.followUp({ content: '🎶 Lofi radio udah nyala lagi nih bro!', ephemeral: true });
        } else {
          await inter.followUp({ content: 'Gagal nyalain radio 😅 Coba cek terminal deh.', ephemeral: true });
        }
        return;
      }

      case 'stop': {
        if (!(await balasAdmin(inter))) return;
        streamAktif = false;
        player.stop();
        const conn = getVoiceConnection(inter.guildId!);
        if (conn) conn.destroy();
        await inter.reply({ content: 'Lofi radio dimatiin. Ketik `/play` buat nyalain lagi ya.', ephemeral: true });
        return;
      }

      case 'lofi': {
        const connection = getVoiceConnection(inter.guildId!);
        let status: string;
        let warna = 2829617;
        const sumber = LOFI_YT_URL ? 'YouTube Live + SomaFM Radio' : 'SomaFM Groove Salad (Radio HTTP)';

        if (!streamAktif) {
          status = '⏹️ Dimatiin manual — ketik `/play` buat nyalain lagi';
          warna = 0xff4444;
        } else if (!connection || connection.state.status !== VoiceConnectionStatus.Ready) {
          status = '🔄 Lagi nyambungin diri ke voice channel...';
          warna = 0xffaa00;
        } else if (player.state.status === AudioPlayerStatus.Playing) {
          status = `🎵 Lagi nyetel di <#${CHANNEL_STUDIO_ID}>`;
          warna = 0x00cc66;
        } else if (player.state.status === AudioPlayerStatus.Buffering) {
          status = '⏳ Lagi loading audio...';
          warna = 0xffaa00;
        } else {
          status = '🔌 Nyambung tapi belum mutar — watchdog lagi kerja';
          warna = 0xffaa00;
        }

        const embed = new EmbedBuilder()
          .setTitle('🎧 Kevin — LoFi Radio')
          .setDescription(status)
          .setColor(warna)
          .addFields(
            { name: 'Sumber', value: sumber, inline: true },
            { name: 'Volume', value: `${Math.round(VOLUME * 100)}%`, inline: true }
          )
          .setFooter({ text: 'Auto-reconnect aktif tiap 30 detik' });
        await inter.reply({ embeds: [embed], ephemeral: true });
        return;
      }

      case 'settings': {
        if (!(await balasAdmin(inter))) return;
        const volume = inter.options.getInteger('volume');
        if (volume === null) {
          await inter.reply({
            content: `Volume sekarang: **${Math.round(VOLUME * 100)}%**\nPakai \`/settings volume:<angka>\` buat ubah.`,
            ephemeral: true
          });
          return;
        }
        if (volume < 0 || volume > 100) {
          await inter.reply({ content: 'Angka volume antara 0 sampai 100 ya.', ephemeral: true });
          return;
        }
        VOLUME = volume / 100;
        const efektif = player.state.status === AudioPlayerStatus.Playing;
        if (efektif && (player.state as any).resource?.volume) {
          (player.state as any).resource.volume.setVolume(VOLUME);
          await inter.reply({ content: `Volume langsung diubah ke **${volume}%** ✅`, ephemeral: true });
        } else {
          await inter.reply({
            content: `Volume diset ke **${volume}%** — efektif saat stream berikutnya diputar.`,
            ephemeral: true
          });
        }
        return;
      }

      case 'help': {
        const embed = new EmbedBuilder()
          .setTitle('🎵 Kevin — Panduan Lofi Radio')
          .setDescription('Bot lofi 24/7 yang otomatis nyetel musik. Ga perlu ngapa-ngapain, langsung dengerin aja 🎧')
          .setColor(2829617)
          .addFields(
            { name: '`/play`', value: 'Nyalain / restart radio (Admin)', inline: false },
            { name: '`/stop`', value: 'Matiin radio dan keluar voice (Admin)', inline: false },
            { name: '`/lofi`', value: 'Cek status radio sekarang', inline: false },
            { name: '`/settings volume:<0-100>`', value: 'Atur volume radio (Admin)', inline: false },
            { name: '💡 Info', value: 'Bot reconnect otomatis kalau putus. Kalau masih mati, coba `/play` ya.', inline: false }
          );
        await inter.reply({ embeds: [embed], ephemeral: true });
        return;
      }
    }
  } catch (err: any) {
    logger.error({ err: String(err).slice(0, 300) }, `[kevin] command error: ${inter.commandName}`);
    if (!inter.replied && !inter.deferred) {
      await inter.reply({ content: 'Ada error pas jalanin command itu 😅', ephemeral: true }).catch(() => {});
    }
  }
});

// ============================================================
// Daftar slash commands + login
// ============================================================

const perintah = [
  new SlashCommandBuilder().setName('play').setDescription('Nyalain atau restart lofi radio (admin)'),
  new SlashCommandBuilder().setName('stop').setDescription('Matiin lofi radio dan keluar voice (admin)'),
  new SlashCommandBuilder().setName('lofi').setDescription('Cek status stream lofi radio sekarang'),
  new SlashCommandBuilder()
    .setName('settings')
    .setDescription('Pengaturan lofi radio (admin)')
    .addIntegerOption((o) =>
      o.setName('volume').setDescription('Atur volume radio (0-100)').setMinValue(0).setMaxValue(100)
    ),
  new SlashCommandBuilder().setName('help').setDescription('Panduan penggunaan lofi radio')
].map((c) => c.toJSON());

client.once('ready', async () => {
  if (!client.user) return;
  const rest = new REST({ version: '10' }).setToken(TOKEN!);
  try {
    if (GUILD_ID) {
      await rest.put(Routes.applicationGuildCommands(client.user.id, GUILD_ID), { body: perintah });
    } else {
      await rest.put(Routes.applicationCommands(client.user.id), { body: perintah });
    }
    logger.info('[kevin] slash command terdaftar');
  } catch (err: any) {
    logger.error({ err: String(err).slice(0, 300) }, '[kevin] sync command error');
  }
});

client.login(TOKEN).catch((err) => {
  logger.error({ err: String(err) }, '[kevin] login gagal — cek KEVIN_TOKEN di .env');
});
