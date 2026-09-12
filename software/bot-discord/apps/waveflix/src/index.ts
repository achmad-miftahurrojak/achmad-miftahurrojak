import {
  Client,
  GuildMember,
  GatewayIntentBits,
  EmbedBuilder,
  ChatInputCommandInteraction,
  REST,
  Routes,
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActivityType,
  CategoryChannel
} from 'discord.js';
import { logger } from '@hamin/utils';
import { CHANNELS, commandChannelMessage, isCommandAllowed } from '@hamin/utils';
import { cariFilm, cariTrending, HasilFilm } from './pencarian';

// ============================================================
// WAVEFLIX — nobar bot (port dari bots/botWaveFlix.py)
// ============================================================

const TOKEN = process.env.WAVEFLIX_TOKEN;
const WAVEFLIX_CATEGORY_ID = process.env.WAVEFLIX_CATEGORY_ID || '1537065953995788338';
const WAVEFLIX_CHANNEL_ID = process.env.WAVEFLIX_CHANNEL_ID || CHANNELS.waveflix;

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

const CHANNEL_RULES = {
  nobar_cari: [CHANNELS.waveflix, CHANNELS.waveflixRoom1, CHANNELS.waveflixRoom2, CHANNELS.waveflixRoom3, CHANNELS.waveflixRoom4, CHANNELS.waveflixRoom5],
  nobar_jadwal: [CHANNELS.waveflix, CHANNELS.waveflixRoom1, CHANNELS.waveflixRoom2, CHANNELS.waveflixRoom3, CHANNELS.waveflixRoom4, CHANNELS.waveflixRoom5]
} as const;

// ============================================================
// View hasil (port HasilNobarView) — tombol link, maks 15 (5 baris x 3)
// ============================================================

function buatView(hasil: HasilFilm[]): ActionRowBuilder<ButtonBuilder>[] {
  const baris: ActionRowBuilder<ButtonBuilder>[] = [];
  const potongan = hasil.slice(0, 15);
  for (let i = 0; i < potongan.length; i += 3) {
    const row = new ActionRowBuilder<ButtonBuilder>();
    for (const h of potongan.slice(i, i + 3)) {
      row.addComponents(
        new ButtonBuilder().setLabel(`${h.judul.slice(0, 20)}...`).setStyle(ButtonStyle.Link).setURL(h.url)
      );
    }
    baris.push(row);
  }
  return baris;
}

function embedFilm(h: HasilFilm): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle(h.judul)
    .setDescription(`[${h.tipe.toUpperCase()}] ${h.deskripsi.slice(0, 250)}...`)
    .setImage(h.poster || null);
}

// ============================================================
// Rekomendasi harian (port rekomendasi_harian)
// ============================================================

async function rekomendasiHarian() {
  const channel = client.channels.cache.get(WAVEFLIX_CHANNEL_ID);
  if (!channel || !channel.isTextBased() || !('purge' in channel)) return;

  const cekPesanTrending = (msg: any): boolean => {
    if (msg.author?.id !== client.user?.id) return false;
    if (!msg.embeds || msg.embeds.length === 0) return false;
    const authorName = msg.embeds[0].author?.name ?? '';
    return authorName.includes('🌟 FILM TRENDING MINGGU INI 🌟');
  };

  try {
    await (channel as any).bulkDelete(50, true);
  } catch {
    // bulkDelete cuma bisa hapus pesan <14 hari; fallback purge dengan filter
    try {
      const pesan = await (channel as any).messages.fetch({ limit: 50 });
      const kena = pesan.filter(cekPesanTrending);
      if (kena.size > 0) await (channel as any).bulkDelete(kena, true);
    } catch (err: any) {
      logger.error({ err: String(err).slice(0, 150) }, '[waveflix] Gagal hapus pesan lama');
    }
  }

  let hasil: HasilFilm[] = [];
  try {
    hasil = await cariTrending();
  } catch (err: any) {
    logger.error({ err: String(err).slice(0, 200) }, '[waveflix] trending error');
    return;
  }
  if (hasil.length === 0) return;

  const embeds = hasil.slice(0, 10).map((h, i) => {
    const e = embedFilm(h);
    if (i === 0) e.setAuthor({ name: '🌟 FILM TRENDING MINGGU INI 🌟', iconURL: client.user?.displayAvatarURL() });
    return e;
  });

  await (channel as any).send({ embeds, components: buatView(hasil) });
}

// ============================================================
// Status berputar
// ============================================================

const STATUS_LIST_WAVEFLIX = [
  'siapin popcorn kita nobar',
  'nonton film gratis tiap hari',
  'cari film bioskop terbaru',
  'jangan lupa ajak temen nobar'
];

function mulaiStatus() {
  setInterval(() => {
    if (!client.user) return;
    const tulisan = STATUS_LIST_WAVEFLIX[Math.floor(Math.random() * STATUS_LIST_WAVEFLIX.length)];
    client.user.setActivity({ name: tulisan, type: ActivityType.Custom });
  }, 10_000);
}

// ============================================================
// Cek kategori WaveFlix Room
// ============================================================

async function diKategoriWaveflix(inter: ChatInputCommandInteraction): Promise<boolean> {
  const channel = inter.channel;
  if (!channel || !(channel as any).parentId || (channel as any).parentId !== WAVEFLIX_CATEGORY_ID) {
    // fallback: cek nama kategori kalau ID env ga cocok
    const parent = (channel as any)?.parent as CategoryChannel | null;
    if (parent instanceof CategoryChannel && /waveflix/i.test(parent.name)) return true;
    await inter.reply({
      content: '❌ Command ini cuma bisa dipakai di dalam kategori **WaveFlix Room**!',
      ephemeral: true
    });
    return false;
  }
  return true;
}

// ============================================================
// Slash commands
// ============================================================

client.on('interactionCreate', async (inter) => {
  if (!inter.isChatInputCommand()) return;
  if (!isCommandAllowed(inter.commandName, inter.channelId, CHANNEL_RULES)) {
    await inter.reply({ content: commandChannelMessage(inter.commandName, CHANNEL_RULES), ephemeral: true });
    return;
  }
  try {
    switch (inter.commandName) {
      case 'nobar_cari': {
        if (!(await diKategoriWaveflix(inter))) return;
        if (!(inter.member as GuildMember | null)?.voice?.channel) {
          await inter.reply({
            content: '❌ Lu harus join Voice Channel dulu sebelum bisa nyari film buat nobar!',
            ephemeral: true
          });
          return;
        }
        await inter.deferReply({ ephemeral: true });
        const judul = inter.options.getString('judul', true);

        let hasil: HasilFilm[];
        try {
          hasil = await cariFilm(judul);
        } catch (err: any) {
          await inter.followUp({ content: `⚠️ Error: ${err.message}`, ephemeral: true });
          return;
        }
        if (hasil.length === 0) {
          await inter.followUp({ content: `🎬 Waduh, film **${judul}** nggak ketemu nih.`, ephemeral: true });
          return;
        }

        const embeds = hasil.slice(0, 10).map((h, i) => {
          const e = embedFilm(h);
          if (i === 0)
            e.setAuthor({ name: `🍿 Hasil Pencarian WaveFlix (${hasil.length} hasil buat '${judul}')` });
          return e;
        });

        await inter.followUp({ embeds, components: buatView(hasil), ephemeral: true });
        return;
      }
      case 'nobar_jadwal': {
        if (!(await diKategoriWaveflix(inter))) return;
        const judul = inter.options.getString('judul', true);
        const waktu = inter.options.getString('waktu', true);
        const link = inter.options.getString('link');

        let deskripsi = `Nanti kita bakal nobar **${judul}** jam **${waktu}**!\nSiapin cemilan dan kopi ☕`;
        deskripsi += `\n\n📍 **Tempat:** ${inter.channel}`;
        if (link) deskripsi += `\n🔗 [Link Film](${link})`;

        const embed = new EmbedBuilder()
          .setTitle('🎬 JADWAL NOBAR BARU!')
          .setDescription(deskripsi)
          .setColor(0xed4245)
          .setAuthor({
            name: inter.user.displayName,
            iconURL: inter.user.displayAvatarURL()
          })
          .setFooter({ text: 'Host: Silakan buka link dan mulai Share Screen di Voice Channel ya!' });

        const channelReservasi = inter.guild?.channels.cache.get(WAVEFLIX_CHANNEL_ID);
        if (channelReservasi?.isTextBased()) {
          await channelReservasi.send({ content: '📢 @here Pengumuman Nobar!', embeds: [embed] });
          await inter.reply({
            content: `✅ Jadwal nobar berhasil disebar ke ${channelReservasi}!`,
            ephemeral: true
          });
        } else {
          await inter.reply({ content: '📢 Pengumuman Nobar!', embeds: [embed] });
        }
        return;
      }
    }
  } catch (err: any) {
    logger.error({ err: String(err).slice(0, 300) }, `[waveflix] command error: ${inter.commandName}`);
    if (!inter.replied && !inter.deferred) {
      await inter.reply({ content: 'Ada error di command itu.', ephemeral: true }).catch(() => {});
    }
  }
});

// ============================================================
// Ready + loop harian
// ============================================================

client.once('ready', async () => {
  logger.info(`[waveflix] Login sebagai ${client.user?.tag} (ID: ${client.user?.id})`);
  mulaiStatus();

  async function jadwalLoop() {
    const now = new Date();
    const targetToday = new Date();
    targetToday.setUTCHours(2, 0, 0, 0); // 09:00 WIB = 02:00 UTC

    const channel = client.channels.cache.get(WAVEFLIX_CHANNEL_ID);
    if (channel && channel.isTextBased()) {
      let sudahKirimHariIni = false;
      try {
        const pesan = await (channel as any).messages.fetch({ limit: 20 });
        const pesanTrending = pesan.find((msg: any) => {
          if (msg.author?.id !== client.user?.id) return false;
          if (!msg.embeds || msg.embeds.length === 0) return false;
          const authorName = msg.embeds[0].author?.name ?? '';
          return authorName.includes('🌟 FILM TRENDING MINGGU INI 🌟');
        });

        if (pesanTrending && pesanTrending.createdAt.getTime() >= targetToday.getTime()) {
          sudahKirimHariIni = true;
        }
      } catch (err) {
        logger.error({ err: String(err).slice(0, 150) }, '[waveflix] Gagal cek pesan history');
      }

      if (!sudahKirimHariIni && now.getTime() >= targetToday.getTime()) {
        logger.info('[waveflix] Rekomendasi harian belum dikirim hari ini, mengirim sekarang...');
        await rekomendasiHarian().catch(err =>
          logger.error({ err: String(err).slice(0, 200) }, '[waveflix] rekomendasiHarian error')
        );
      }
    } else if (!channel) {
      // Jika channel belum ter-fetch cache, coba fetch manual atau tunggu
      try {
        await client.channels.fetch(WAVEFLIX_CHANNEL_ID);
        // panggil ulang dalam 10 detik agar cache terisi
        setTimeout(jadwalLoop, 10_000);
        return;
      } catch (err) {
        logger.error({ err: String(err).slice(0, 150) }, '[waveflix] Gagal fetch channel reservasi');
      }
    }

    const nextTarget = new Date();
    nextTarget.setUTCHours(2, 0, 0, 0);
    if (new Date().getTime() >= nextTarget.getTime()) {
      nextTarget.setUTCDate(nextTarget.getUTCDate() + 1);
    }

    const selisihMs = nextTarget.getTime() - new Date().getTime();
    logger.info(`[waveflix] rekomendasi harian berikutnya dijadwalkan ${Math.round(selisihMs / 60_000)} menit lagi (jam 09:00 WIB)`);

    setTimeout(async () => {
      await rekomendasiHarian().catch(err =>
        logger.error({ err: String(err).slice(0, 200) }, '[waveflix] rekomendasiHarian error')
      );
      jadwalLoop();
    }, selisihMs);
  }

  jadwalLoop();
});


// ============================================================
// Daftar slash commands + login
// ============================================================

const perintah = [
  new SlashCommandBuilder()
    .setName('nobar_cari')
    .setDescription('Cari film di WaveFlix buat nobar!')
    .addStringOption((o) =>
      o.setName('judul').setDescription('Judul film atau serial yang mau ditonton').setRequired(true)
    ),
  new SlashCommandBuilder()
    .setName('nobar_jadwal')
    .setDescription('Bikin jadwal nobar dan kumpulin massa!')
    .addStringOption((o) => o.setName('judul').setDescription('Judul film yang mau dinobar').setRequired(true))
    .addStringOption((o) =>
      o.setName('waktu').setDescription("Jam berapa? (contoh: 19:30 atau 'nanti malam')").setRequired(true)
    )
    .addStringOption((o) => o.setName('link').setDescription('Link film dari WaveFlix (opsional)'))
].map((c) => c.toJSON());

client.once('ready', async () => {
  if (!client.user || !TOKEN) return;
  const rest = new REST({ version: '10' }).setToken(TOKEN);
  try {
    await rest.put(Routes.applicationCommands(client.user.id), { body: perintah });
    logger.info('[waveflix] slash command terdaftar');
  } catch (err: any) {
    logger.error({ err: String(err).slice(0, 300) }, '[waveflix] sync command error');
  }
});

if (!TOKEN) {
  logger.info('[waveflix] WAVEFLIX_TOKEN belum ada di .env');
} else {
  client.login(TOKEN).catch((err) => {
    logger.error({ err: String(err) }, '[waveflix] login gagal');
  });
}
