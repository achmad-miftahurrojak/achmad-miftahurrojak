import {
  Client,
  GuildMember,
  GatewayIntentBits,
  EmbedBuilder,
  ChatInputCommandInteraction,
  REST,
  Routes,
  SlashCommandBuilder,
  ActivityType,
  VoiceBasedChannel
} from 'discord.js';
import {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  VoiceConnectionStatus,
  entersState,
  getVoiceConnection,
  AudioPlayer,
  StreamType
} from '@discordjs/voice';
import { spawn } from 'child_process';
import { logger } from '@hamin/utils';
import { CHANNELS, commandChannelMessage, isCommandAllowed } from '@hamin/utils';

// ============================================================
// TIDETUNES — musik bot (port dari bots/botTideTunes.py)
// Lavalink diganti @discordjs/voice + yt-dlp (sumber SoundCloud)
// ============================================================

const TOKEN = process.env.TIDETUNES_TOKEN;
const GEMINI_KEY = process.env.GEMINI_API_KEY;

const ffmpegPath: string = require('ffmpeg-static');
const ytdlp = require('youtube-dl-exec');

const ALLOWED_VOICE_CHANNELS = [
  '1453704065979646083', // pantai utara
  '1536886429429268540', // pantai selatan
  '1536886487445016747', // pantai timur
  '1536886534115037232', // pantai barat
  '1536886710116556810'  // panggung
];

interface Lagu {
  judul: string;
  penyanyi: string;
  url: string;
  durasiMs: number;
  artwork?: string;
}

interface GuildState {
  antrean: Lagu[];
  riwayat: string[];
  autoplay: boolean;
  autoplayLock: boolean;
  pemutar: AudioPlayer;
  timeoutIdle: NodeJS.Timeout | null;
  laguSekarang: Lagu | null;
}

const state = new Map<string, GuildState>();

function ambilState(guildId: string): GuildState {
  let s = state.get(guildId);
  if (!s) {
    s = {
      antrean: [],
      riwayat: [],
      autoplay: false,
      autoplayLock: false,
      pemutar: createAudioPlayer(),
      timeoutIdle: null,
      laguSekarang: null
    };
    s.pemutar.on('error', (err) => logger.error({ err: err.message }, '[tidetunes] audio player error'));
    state.set(guildId, s);
  }
  return s;
}

function hapusState(guildId: string) {
  const s = state.get(guildId);
  if (s?.timeoutIdle) clearTimeout(s.timeoutIdle);
  state.delete(guildId);
}

// ============================================================
// Pencarian lagu via yt-dlp (SoundCloud, port TrackSource.SoundCloud)
// ============================================================

async function cariLagu(query: string, jumlah = 1): Promise<Lagu[]> {
  try {
    const info = await ytdlp(`scsearch${jumlah}:${query}`, {
      format: 'bestaudio/best',
      quiet: true,
      noWarnings: true,
      dumpSingleJson: true,
      noCheckCertificates: true,
      preferFreeFormats: true,
      // Dapatkan URL stream langsung, bukan halaman web
      getUrl: false,
    });
    const entri = Array.isArray(info?.entries) ? info.entries : [info];
    return entri
      .filter((e: any) => e?.url || e?.webpage_url)
      .map((e: any) => ({
        judul: String(e.title ?? 'Tanpa judul'),
        penyanyi: String(e.uploader ?? e.channel ?? 'Tanpa artis'),
        // Pakai webpage_url biar bisa di-proses ffmpeg via ytdlp pipe
        url: String(e.webpage_url ?? e.url),
        durasiMs: (Number(e.duration ?? 0) || 0) * 1000,
        artwork: e.thumbnail ? String(e.thumbnail) : undefined
      }));
  } catch (err: any) {
    logger.error({ err: String(err).slice(0, 200) }, `[tidetunes] gagal cari: ${query.slice(0, 60)}`);
    return [];
  }
}

// ============================================================
// Buat audio resource dengan pipe ffmpeg (sama seperti Kevin)
// Ini penting karena SoundCloud URL butuh ffmpeg untuk decode
// ============================================================

function buatResourceFromUrl(url: string) {
  const ffmpegProc = spawn(ffmpegPath, [
    '-reconnect', '1',
    '-reconnect_streamed', '1',
    '-reconnect_delay_max', '5',
    '-i', url,
    '-vn',
    '-ar', '48000',
    '-ac', '2',
    '-f', 's16le',
    '-loglevel', 'error',
    'pipe:1'
  ], { stdio: ['ignore', 'pipe', 'ignore'] });

  ffmpegProc.on('error', (err) => {
    logger.error({ err: err.message }, '[tidetunes] ffmpeg subprocess error');
  });

  const resource = createAudioResource(ffmpegProc.stdout!, {
    inputType: StreamType.Raw,
    inlineVolume: true
  });
  resource.volume?.setVolume(0.5);
  return resource;
}

// ============================================================
// Scraper Spotify embed (port ambil_playlist_spotify & ekstrak_metadata_single_spotify)
// ============================================================

async function ambilEmbedSpotify(jenis: 'playlist' | 'track', id: string): Promise<any | null> {
  try {
    const res = await fetch(`https://open.spotify.com/embed/${jenis}/${id}`, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
        Accept: 'text/html'
      },
      signal: AbortSignal.timeout(10_000)
    });
    if (!res.ok) return null;
    const html = await res.text();
    const cocok = html.match(/<script id="__NEXT_DATA__" type="application\/json">([^<]+)<\/script>/);
    if (!cocok) return null;
    return JSON.parse(cocok[1]);
  } catch (err: any) {
    logger.error({ err: String(err).slice(0, 200) }, '[tidetunes] gagal ambil embed Spotify');
    return null;
  }
}

async function ambilPlaylistSpotify(url: string): Promise<string[]> {
  const m = url.match(/playlist\/([a-zA-Z0-9]+)/);
  if (!m) return [];
  const data = await ambilEmbedSpotify('playlist', m[1]);
  const trackList =
    data?.props?.pageProps?.state?.data?.entity?.trackList ?? data?.props?.pageProps?.state?.data?.entity?.items ?? [];
  const hasil: string[] = [];
  for (const t of trackList) {
    const judul = t.title ?? '';
    const subtitle = t.subtitle ?? '';
    if (judul) hasil.push(`${judul} ${subtitle}`.trim());
  }
  return hasil;
}

async function ekstrakMetadataSingleSpotify(query: string): Promise<string> {
  if (!query.includes('spotify.com/track/')) return query;
  const m = query.match(/track\/([a-zA-Z0-9]+)/);
  if (!m) return query;
  const data = await ambilEmbedSpotify('track', m[1]);
  const entity = data?.props?.pageProps?.state?.data?.entity;
  if (entity) {
    const judul = entity.name ?? entity.title ?? '';
    const artis = (entity.artists ?? []).map((a: any) => a.name ?? '').join(' ');
    if (judul) return `${judul} ${artis}`.trim();
  }
  return query;
}

// ============================================================
// AI Auto-DJ (Gemini via REST, port process_autoplay)
// ============================================================

async function rekomendasiGemini(riwayat: string[]): Promise<string[]> {
  if (!GEMINI_KEY) return [];
  const prompt =
    `Gua habis dengerin lagu-lagu ini: ${riwayat.join(', ')}. ` +
    'Tolong kasih gua 10 rekomendasi lagu baru yang vibes, genre, atau beat-nya mirip dan nyambung banget sama lagu-lagu itu. ' +
    'Jangan kasih lagu yang udah ada di list itu. ' +
    "Balas HANYA dengan 10 baris, setiap baris formatnya: 'Judul Lagu - Nama Artis'. " +
    'Jangan ada nomor urut, jangan ada teks pembuka/penutup.';
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_KEY! },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
        signal: AbortSignal.timeout(30_000)
      }
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data: any = await res.json();
    const teks: string = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    return teks
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l && l.includes('-') && !l.startsWith('*') && !l.toLowerCase().startsWith('berikut'));
  } catch (err: any) {
    logger.error({ err: String(err).slice(0, 200) }, '[tidetunes] error pre-fetch AI Auto-DJ');
    return [];
  }
}

async function prosesAutoplay(guildId: string, s: GuildState) {
  if (!s.autoplay) return;
  if (!GEMINI_KEY) {
    s.autoplay = false;
    logger.info('[tidetunes] AI Auto-DJ dimatikan: GEMINI_API_KEY belum disetel.');
    return;
  }
  if (s.autoplayLock) return;
  if (s.antrean.length >= 3) return;

  s.autoplayLock = true;
  try {
    const riwayat = [...s.riwayat];
    if (riwayat.length === 0) return;
    const rekomendasi = await rekomendasiGemini(riwayat);
    for (const rec of rekomendasi) {
      const hasil = await cariLagu(rec, 1);
      if (hasil[0]) s.antrean.push(hasil[0]);
    }
    // kalau ga ada yang muter sekarang, langsung mulai
    if (s.antrean.length > 0) mulaiBerikutnya(guildId, s);
  } finally {
    s.autoplayLock = false;
  }
}

// ============================================================
// Pemutar (port on_wavelink_track_start / track_end / inactivity)
// ============================================================

function mulaiBerikutnya(guildId: string, s: GuildState): boolean {
  const berikut = s.antrean.shift();
  if (!berikut) return false;
  s.laguSekarang = berikut;
  s.riwayat.push(berikut.judul);
  if (s.riwayat.length > 10) s.riwayat.shift();

  try {
    // Pipe melalui ffmpeg — SoundCloud URL tidak bisa langsung dimuat
    const resource = buatResourceFromUrl(berikut.url);
    s.pemutar.play(resource);
    logger.info(`[tidetunes] ▶ ${berikut.judul} — ${berikut.penyanyi}`);
  } catch (err: any) {
    logger.error({ err: String(err).slice(0, 200) }, '[tidetunes] gagal play');
    return mulaiBerikutnya(guildId, s);
  }

  // trigger AI DJ kalau antrean tinggal sedikit
  if (s.autoplay && s.antrean.length < 2) void prosesAutoplay(guildId, s);
  return true;
}

function pasangListenerIdle(s: GuildState, guildId: string) {
  s.pemutar.on(AudioPlayerStatus.Idle, () => {
    const st = state.get(guildId);
    if (!st) return;
    if (st.antrean.length > 0) {
      mulaiBerikutnya(guildId, st);
      return;
    }
    // port track_end: tunggu 10 detik, kalau masih sepi disconnect
    if (st.timeoutIdle) clearTimeout(st.timeoutIdle);
    st.timeoutIdle = setTimeout(() => {
      const cek = state.get(guildId);
      if (!cek || (cek.antrean.length === 0 && cek.pemutar.state.status !== AudioPlayerStatus.Playing)) {
        const conn = getVoiceConnection(guildId);
        if (conn) conn.destroy();
        hapusState(guildId);
        logger.info(`[tidetunes] Disconnect dari ${guildId} karena tidak ada aktivitas.`);
      }
    }, 10_000);
  });
  s.pemutar.on(AudioPlayerStatus.Playing, () => {
    const st = state.get(guildId);
    if (st?.timeoutIdle) {
      clearTimeout(st.timeoutIdle);
      st.timeoutIdle = null;
    }
  });
}

async function gabungChannel(inter: ChatInputCommandInteraction, channel: VoiceBasedChannel): Promise<GuildState | null> {
  if (!ALLOWED_VOICE_CHANNELS.includes(channel.id)) {
    return null;
  }
  const guildId = inter.guildId!;
  const s = ambilState(guildId);
  pasangListenerIdle(s, guildId);

  let conn = getVoiceConnection(guildId);
  if (!conn) {
    conn = joinVoiceChannel({
      channelId: channel.id,
      guildId,
      adapterCreator: inter.guild!.voiceAdapterCreator as any,
      selfDeaf: false
    });
    try {
      await entersState(conn, VoiceConnectionStatus.Ready, 20_000);
    } catch {
      conn.destroy();
      return null;
    }
  } else {
    // pindah channel kalau beda
    const connAny = conn as any;
    if (connAny.joinConfig?.channelId !== channel.id) {
      conn = joinVoiceChannel({
        channelId: channel.id,
        guildId,
        adapterCreator: inter.guild!.voiceAdapterCreator as any,
        selfDeaf: false
      });
    }
  }
  conn.subscribe(s.pemutar);
  return s;
}

// ============================================================
// Client & status berputar
// ============================================================

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates]
});

const CHANNEL_RULES = {
  play: ALLOWED_VOICE_CHANNELS, skip: ALLOWED_VOICE_CHANNELS, stop: ALLOWED_VOICE_CHANNELS, queue: ALLOWED_VOICE_CHANNELS,
  autoplay: ALLOWED_VOICE_CHANNELS, pause: ALLOWED_VOICE_CHANNELS, resume: ALLOWED_VOICE_CHANNELS,
  nowplaying: ALLOWED_VOICE_CHANNELS, volume: ALLOWED_VOICE_CHANNELS, shuffle: ALLOWED_VOICE_CHANNELS, remove: ALLOWED_VOICE_CHANNELS
} as const;

const STATUS_LIST = ['siap muterin lagu', '/play buat ngegas', 'DJ paling murah se-Indonesia', 'SoundCloud rapih banget'];

client.once('ready', async () => {
  logger.info(`[tidetunes] login sebagai ${client.user?.tag}`);
  setInterval(() => {
    if (!client.user) return;
    const tulisan = STATUS_LIST[Math.floor(Math.random() * STATUS_LIST.length)];
    client.user.setActivity({ name: tulisan, type: ActivityType.Custom });
  }, 10_000);

  if (GEMINI_KEY) logger.info('[tidetunes] AI Auto-DJ siap (GEMINI_API_KEY ada)');
  else logger.info('[tidetunes] GEMINI_API_KEY belum diset — /autoplay nonaktif');
});

// ============================================================
// Slash command handlers
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
        const voiceChannel = (inter.member as GuildMember | null)?.voice?.channel ?? null;
        if (!voiceChannel) {
          await inter.reply({ content: '❌ Lu harus join Voice Channel dulu!', ephemeral: true });
          return;
        }
        if (!ALLOWED_VOICE_CHANNELS.includes(voiceChannel.id)) {
          await inter.reply({
            content: '❌ TideTunes hanya diperbolehkan masuk ke channel voice: Pantai Utara, Pantai Selatan, Pantai Timur, Pantai Barat, atau Panggung!',
            ephemeral: true
          });
          return;
        }
        await inter.deferReply({ ephemeral: true });
        const query = inter.options.getString('query', true);
        const s = await gabungChannel(inter, voiceChannel);
        if (!s) {
          await inter.followUp({ content: '❌ Gagal masuk ke Voice Channel.' });
          return;
        }

        // Playlist Spotify → ambil daftar, putar pertama, sisanya background
        if (query.includes('spotify.com/playlist/')) {
          await inter.followUp({ content: '🔍 Mengambil data dari Spotify Playlist...' });
          const daftarLagu = await ambilPlaylistSpotify(query);
          if (daftarLagu.length === 0) {
            await inter.followUp({ content: '❌ Gagal mendapatkan lagu dari playlist atau playlist kosong.' });
            return;
          }
          const pertama = daftarLagu.shift()!;
          const hasilPertama = await cariLagu(pertama, 1);
          if (!hasilPertama[0]) {
            await inter.followUp({ content: '❌ Gagal menemukan lagu pertama di SoundCloud.' });
            return;
          }
          s.antrean.push(hasilPertama[0]);
          const lagiMuter = mulaiBerikutnya(inter.guildId!, s);

          void (async () => {
            for (const q of daftarLagu) {
              const hasil = await cariLagu(q, 1);
              if (hasil[0]) s.antrean.push(hasil[0]);
              await new Promise((r) => setTimeout(r, 500));
            }
            logger.info(`[tidetunes] background playlist selesai (${daftarLagu.length} lagu)`);
          })();

          if (lagiMuter) {
            await inter.followUp({
              content: `🎵 Memutar lagu pertama: **${hasilPertama[0].judul}**\n📝 **${daftarLagu.length} lagu lainnya** sedang dicari di background!`
            });
          } else {
            await inter.followUp({
              content: `📝 Berhasil memasukkan **${daftarLagu.length + 1} lagu** ke dalam antrean (via background)!`
            });
          }
          return;
        }

        const bersih = await ekstrakMetadataSingleSpotify(query);
        const hasil = await cariLagu(bersih, 15);
        if (hasil.length === 0) {
          await inter.followUp({ content: '❌ Gagal menemukan lagu tersebut di SoundCloud.' });
          return;
        }
        if (hasil.length > 1) {
          // hasil search banyak → masukin semua kayak playlist
          s.antrean.push(...hasil);
          const lagiMuter = mulaiBerikutnya(inter.guildId!, s);
          await inter.followUp({
            content: lagiMuter
              ? `🎵 Memutar lagu pertama: **${hasil[0].judul}**\n📝 **${hasil.length - 1} lagu lainnya** masuk antrean!`
              : `📝 Berhasil memasukkan **${hasil.length} lagu** ke dalam antrean!`
          });
          return;
        }
        const lagu = hasil[0];
        s.antrean.push(lagu);
        const lagiMuter = mulaiBerikutnya(inter.guildId!, s);
        await inter.followUp({
          content: lagiMuter ? `🎵 Sedang memutar: **${lagu.judul}**` : `📝 Dimasukkan ke antrean: **${lagu.judul}**`
        });
        return;
      }
      case 'skip': {
        const s = inter.guildId ? state.get(inter.guildId) : null;
        if (s && s.pemutar.state.status === AudioPlayerStatus.Playing) {
          s.pemutar.stop();
          await inter.reply({ content: '⏭️ Lagu dilewati!', ephemeral: true });
        } else {
          await inter.reply({ content: '❌ Nggak ada lagu yang lagi diputar.', ephemeral: true });
        }
        return;
      }
      case 'stop': {
        const conn = getVoiceConnection(inter.guildId!);
        if (conn) {
          const s = state.get(inter.guildId!);
          if (s) {
            s.antrean = [];
            s.autoplay = false;
            s.pemutar.stop();
          }
          conn.destroy();
          hapusState(inter.guildId!);
          await inter.reply({ content: '🛑 Musik dihentikan dan TideTunes keluar dari VC.', ephemeral: true });
        } else {
          await inter.reply({ content: '❌ TideTunes nggak lagi di Voice Channel.', ephemeral: true });
        }
        return;
      }
      case 'queue': {
        const s = inter.guildId ? state.get(inter.guildId) : null;
        if (s && s.antrean.length > 0) {
          const tampil = s.antrean.slice(0, 15);
          let antrean = tampil.map((l, i) => `${i + 1}. ${l.judul} - ${l.penyanyi}`).join('\n');
          if (s.antrean.length > 15) antrean += `\n\n... dan **${s.antrean.length - 15} lagu lainnya**`;
          antrean += `\n\n📊 Total: **${s.antrean.length} lagu** dalam antrean`;
          await inter.reply({ content: `🎶 **Antrean Lagu:**\n${antrean}`, ephemeral: true });
        } else {
          await inter.reply({ content: '📭 Antrean kosong.', ephemeral: true });
        }
        return;
      }
      case 'autoplay': {
        const pilih = inter.options.getString('status', true);
        const s = inter.guildId ? ambilState(inter.guildId) : null;
        if (!s) return;
        if (pilih === 'on') {
          if (!GEMINI_KEY) {
            await inter.reply({ content: '❌ AI Auto-DJ butuh `GEMINI_API_KEY` di file `.env`.', ephemeral: true });
            return;
          }
          s.autoplay = true;
          await inter.reply({
            content: '🤖 **AI Auto-DJ diaktifkan!** TideTunes bakal nyariin lagu otomatis kalau antrean habis.',
            ephemeral: true
          });
          void prosesAutoplay(inter.guildId!, s);
        } else {
          s.autoplay = false;
          await inter.reply({
            content: '🛑 **AI Auto-DJ dimatikan!** TideTunes akan keluar kalau antrean lagu habis.',
            ephemeral: true
          });
        }
        return;
      }
      case 'pause': {
        const s = inter.guildId ? state.get(inter.guildId) : null;
        if (s && s.pemutar.state.status === AudioPlayerStatus.Playing) {
          s.pemutar.pause();
          await inter.reply({ content: '⏸️ Lagu dijeda.', ephemeral: true });
        } else {
          await inter.reply({ content: '❌ Nggak ada lagu yang lagi diputar.', ephemeral: true });
        }
        return;
      }
      case 'resume': {
        const s = inter.guildId ? state.get(inter.guildId) : null;
        if (s && s.pemutar.state.status === AudioPlayerStatus.Paused) {
          s.pemutar.unpause();
          await inter.reply({ content: '▶️ Lagu dilanjutkan.', ephemeral: true });
        } else {
          await inter.reply({ content: '❌ Nggak ada lagu yang lagi dijeda.', ephemeral: true });
        }
        return;
      }
      case 'nowplaying': {
        const s = inter.guildId ? state.get(inter.guildId) : null;
        if (!s || !s.laguSekarang || s.pemutar.state.status === AudioPlayerStatus.Idle) {
          await inter.reply({ content: '❌ Nggak ada lagu yang lagi diputar.', ephemeral: true });
          return;
        }
        const lagu = s.laguSekarang;
        const icon = s.pemutar.state.status === AudioPlayerStatus.Paused ? '⏸️ Dijeda' : '▶️ Sedang Diputar';
        let durasi = 'Live / Tidak diketahui';
        if (lagu.durasiMs > 0) {
          const m = Math.floor(lagu.durasiMs / 60000);
          const dtk = Math.floor((lagu.durasiMs % 60000) / 1000);
          durasi = `${m}:${String(dtk).padStart(2, '0')}`;
        }
        const embed = new EmbedBuilder()
          .setTitle('🎵 Now Playing')
          .setDescription(`**${lagu.judul}** - ${lagu.penyanyi}`)
          .setColor(0x1ed760)
          .addFields(
            { name: 'Status', value: icon, inline: true },
            { name: 'Durasi', value: durasi, inline: true },
            { name: 'Antrean', value: `${s.antrean.length} lagu`, inline: true }
          )
          .setFooter({ text: `AI Auto-DJ: ${s.autoplay ? '🟢 Aktif' : '🔴 Mati'}` });
        if (lagu.artwork) embed.setThumbnail(lagu.artwork);
        await inter.reply({ embeds: [embed], ephemeral: true });
        return;
      }
      case 'volume': {
        const level = inter.options.getInteger('level', true);
        if (level < 0 || level > 100) {
          await inter.reply({ content: '❌ Volume harus antara 0 dan 100.', ephemeral: true });
          return;
        }
        const s = inter.guildId ? state.get(inter.guildId) : null;
        const resource = (s?.pemutar.state as any)?.resource;
        if (s && resource?.volume) {
          resource.volume.setVolume(level / 100);
          const emoji = level >= 70 ? '🔊' : level >= 30 ? '🔉' : level > 0 ? '🔈' : '🔇';
          await inter.reply({ content: `${emoji} Volume diset ke **${level}%**`, ephemeral: true });
        } else {
          await inter.reply({ content: '❌ Nggak ada lagu yang lagi diputar.', ephemeral: true });
        }
        return;
      }
      case 'shuffle': {
        const s = inter.guildId ? state.get(inter.guildId) : null;
        if (s && s.antrean.length > 1) {
          for (let i = s.antrean.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [s.antrean[i], s.antrean[j]] = [s.antrean[j], s.antrean[i]];
          }
          await inter.reply({ content: `🔀 Antrean diacak! (${s.antrean.length} lagu)`, ephemeral: true });
        } else {
          await inter.reply({ content: '❌ Antrean kosong atau cuma ada 1 lagu.', ephemeral: true });
        }
        return;
      }
      case 'remove': {
        const nomor = inter.options.getInteger('nomor', true);
        const s = inter.guildId ? state.get(inter.guildId) : null;
        if (!s || s.antrean.length === 0) {
          await inter.reply({ content: '❌ Antrean kosong.', ephemeral: true });
          return;
        }
        if (nomor < 1 || nomor > s.antrean.length) {
          await inter.reply({
            content: `❌ Nomor nggak valid. Pilih antara 1 - ${s.antrean.length}.`,
            ephemeral: true
          });
          return;
        }
        const [dihapus] = s.antrean.splice(nomor - 1, 1);
        await inter.reply({ content: `🗑️ Dihapus dari antrean: **${dihapus.judul}**`, ephemeral: true });
        return;
      }
    }
  } catch (err: any) {
    logger.error({ err: String(err).slice(0, 300) }, `[tidetunes] command error: ${inter.commandName}`);
    if (!inter.replied && !inter.deferred) {
      await inter.reply({ content: 'Ada error di command itu.', ephemeral: true }).catch(() => {});
    }
  }
});

// ============================================================
// Daftar slash commands + login
// ============================================================

const perintah = [
  new SlashCommandBuilder()
    .setName('play')
    .setDescription('Putar lagu atau baca link playlist (Spotify/YouTube/SoundCloud)')
    .addStringOption((o) => o.setName('query').setDescription('Judul lagu yang mau diputar').setRequired(true)),
  new SlashCommandBuilder().setName('skip').setDescription('Lewati lagu yang sedang diputar'),
  new SlashCommandBuilder().setName('stop').setDescription('Hentikan musik dan bot keluar dari VC'),
  new SlashCommandBuilder().setName('queue').setDescription('Lihat antrean lagu'),
  new SlashCommandBuilder()
    .setName('autoplay')
    .setDescription('Nyalakan/matikan AI Auto-DJ Gemini')
    .addStringOption((o) =>
      o.setName('status').setDescription('On atau off').setRequired(true).addChoices(
        { name: 'On', value: 'on' },
        { name: 'Off', value: 'off' }
      )
    ),
  new SlashCommandBuilder().setName('pause').setDescription('Jeda lagu yang sedang diputar'),
  new SlashCommandBuilder().setName('resume').setDescription('Lanjutkan lagu yang dijeda'),
  new SlashCommandBuilder().setName('nowplaying').setDescription('Lihat lagu yang sedang diputar'),
  new SlashCommandBuilder()
    .setName('volume')
    .setDescription('Atur volume musik (0-100)')
    .addIntegerOption((o) => o.setName('level').setDescription('Volume level (0-100)').setRequired(true).setMinValue(0).setMaxValue(100)),
  new SlashCommandBuilder().setName('shuffle').setDescription('Acak urutan antrean lagu'),
  new SlashCommandBuilder()
    .setName('remove')
    .setDescription('Hapus lagu dari antrean berdasarkan nomor')
    .addIntegerOption((o) => o.setName('nomor').setDescription("Nomor lagu di antrean (lihat /queue)").setRequired(true))
].map((c) => c.toJSON());

client.once('ready', async () => {
  if (!client.user || !TOKEN) return;
  const rest = new REST({ version: '10' }).setToken(TOKEN);
  try {
    await rest.put(Routes.applicationCommands(client.user.id), { body: perintah });
    logger.info('[tidetunes] slash command terdaftar');
  } catch (err: any) {
    logger.error({ err: String(err).slice(0, 300) }, '[tidetunes] sync command error');
  }
});

if (!TOKEN) {
  logger.info('[tidetunes] Token tidak ditemukan di .env (TIDETUNES_TOKEN). Bot tidak dijalankan.');
} else {
  client.login(TOKEN).catch((err) => {
    logger.error({ err: String(err) }, '[tidetunes] login gagal');
  });
}
