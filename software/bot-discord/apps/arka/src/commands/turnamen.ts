import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  Message,
  EmbedBuilder,
  GuildMember,
  
  TextChannel
} from 'discord.js';
import { Command } from '../handler';
import {
  WARNA,
  TURNAMEN_MIN,
  TURNAMEN_MAKS,
  TURNAMEN_DAFTAR_MENIT,
  TURNAMEN_PILIH_DETIK,
  TURNAMEN_HADIAH
} from '../config';
import {
  diArena,
  beriXp,
  catatMain,
  prisma,
  buatSesi,
  matikanSesi,
  sesiAktif,
  tombol,
  barisTombol
} from '../gameCore';
import { soal, cocok } from './trivia';
import { laguBank } from './lagu';

const KALAHIN: Record<string, string> = { batu: 'gunting', gunting: 'kertas', kertas: 'batu' };
const EMOJI_SUIT: Record<string, string> = { batu: '🪨', gunting: '✂️', kertas: '📄' };

const turnamenJalan = new Set<string>();

function sesiHidup(sesiId: string): boolean {
  return (sesiAktif as Map<string, unknown>).has(sesiId);
}

async function tungguSesiMati(sesiId: string, batasDetik: number) {
  const mulai = Date.now();
  while (sesiHidup(sesiId) && Date.now() - mulai < (batasDetik + 2) * 1000) {
    await new Promise((r) => setTimeout(r, 500));
  }
  matikanSesi(sesiId);
}

// ============================================================
// Ronde suit (port PilihSuit)
// ============================================================

interface PilihanSuit {
  aId: string;
  bId: string;
  pilihan: Record<string, string>;
}

async function mainSatuRonde(channel: any, a: GuildMember, b: GuildMember): Promise<[GuildMember, GuildMember]> {
  for (let percobaan = 0; percobaan < 3; percobaan++) {
    const keadaan: PilihanSuit = { aId: a.id, bId: b.id, pilihan: {} };
    const sesiId = buatSesi(async (btn, aksi) => {
      if (btn.user.id !== keadaan.aId && btn.user.id !== keadaan.bId) {
        await btn.reply({ content: 'Lo bukan yang lagi tanding. Nonton aja.', ephemeral: true });
        return;
      }
      if (btn.user.id in keadaan.pilihan) {
        await btn.reply({ content: 'Lo udah milih.', ephemeral: true });
        return;
      }
      keadaan.pilihan[btn.user.id] = aksi;
      await btn.reply({ content: `Oke, **${aksi}**. Jangan bocorin.`, ephemeral: true });
      if (Object.keys(keadaan.pilihan).length === 2) {
        matikanSesi(sesiId!);
      } else {
        const nunggu = btn.user.id === keadaan.aId ? b : a;
        const pesanTanding = pesanRef[0];
        if (pesanTanding) {
          await pesanTanding
            .edit(`⚔️ **${a.displayName}** vs **${b.displayName}**\nNunggu ${nunggu.displayName}...`)
            .catch(() => {});
        }
      }
    }, TURNAMEN_PILIH_DETIK);

    const pesanRef: (Message | null)[] = [null];
    const pesan = await channel.send({
      content:
        `⚔️ **${a.displayName}** vs **${b.displayName}**\nPilih dalam ${TURNAMEN_PILIH_DETIK} detik.` +
        (percobaan ? '\n_Seri, ulang._' : ''),
      components: barisTombol(
        tombol('Batu', '🪨', sesiId, 'batu'),
        tombol('Gunting', '✂️', sesiId, 'gunting'),
        tombol('Kertas', '📄', sesiId, 'kertas')
      )
    });
    pesanRef[0] = pesan;

    await tungguSesiMati(sesiId, TURNAMEN_PILIH_DETIK);
    await pesan.edit({ components: [] }).catch(() => {});

    const pa = keadaan.pilihan[a.id];
    const pb = keadaan.pilihan[b.id];
    if (!pa && !pb) {
      const menang = Math.random() < 0.5 ? a : b;
      await channel.send(`Dua duanya diem aja. Gua lempar koin — **${menang.displayName}** yang lanjut.`);
      return [menang, menang === a ? b : a];
    }
    if (!pa) {
      await channel.send(`**${a.displayName}** ga milih. **${b.displayName}** lanjut.`);
      return [b, a];
    }
    if (!pb) {
      await channel.send(`**${b.displayName}** ga milih. **${a.displayName}** lanjut.`);
      return [a, b];
    }
    const teksHasil = `${EMOJI_SUIT[pa]} vs ${EMOJI_SUIT[pb]}`;
    if (pa === pb) {
      await channel.send(`${teksHasil} — seri.`);
      continue;
    }
    if (KALAHIN[pa] === pb) {
      await channel.send(`${teksHasil}\n🌊 **${a.displayName}** menang.`);
      return [a, b];
    }
    await channel.send(`${teksHasil}\n🌊 **${b.displayName}** menang.`);
    return [b, a];
  }
  const menang = Math.random() < 0.5 ? a : b;
  await channel.send(`Seri terus tiga kali. **${menang.displayName}** lanjut karena gua males.`);
  return [menang, menang === a ? b : a];
}

// ============================================================
// Ronde trivia & lagu (pakai wait_for pesan chat)
// ============================================================

async function rondeKuis(
  channel: any,
  a: GuildMember,
  b: GuildMember,
  judul: string,
  soalnya: string,
  jawaban: string[],
  footer: string
): Promise<[GuildMember, GuildMember]> {
  const isi = new EmbedBuilder()
    .setColor(WARNA)
    .setTitle(`${judul} ${a.displayName} vs ${b.displayName}`)
    .setDescription(soalnya)
    .setFooter({ text: footer });
  await channel.send({ embeds: [isi] });

  const hasil = await tungguJawaban(channel, [a.id, b.id], jawaban, 40);
  if (!hasil) {
    const menang = Math.random() < 0.5 ? a : b;
    await channel.send(`⏰ Waktu habis, ga ada yang bener. Jawabannya **${jawaban[0]}**.\nGua lempar koin — **${menang.displayName}** yang lanjut.`);
    return [menang, menang === a ? b : a];
  }
  const menang = hasil === a.id ? a : b;
  const kalah = menang === a ? b : a;
  await channel.send(`✅ **${menang.displayName}** duluan! Jawabannya **${jawaban[0]}**.`);
  return [menang, kalah];
}

/** Tunggu satu pesan di channel yang isinya cocok sama jawaban, dari dua pemain. */
function tungguJawaban(
  channel: any,
  pemainIds: string[],
  jawaban: string[],
  detik: number
): Promise<string | null> {
  return new Promise((resolve) => {
    const handler = async (pesan: Message) => {
      if (pesan.channel.id !== channel.id) return;
      if (!pemainIds.includes(pesan.author.id)) return;
      if (pesan.author.bot) return;
      if (cocok(pesan.content, jawaban)) {
        selesai();
        resolve(pesan.author.id);
      }
    };
    let timer: NodeJS.Timeout;
    function selesai() {
      clearTimeout(timer);
      client.off('messageCreate', handler);
    }
    const client = (channel as any).client;
    client.on('messageCreate', handler);
    timer = setTimeout(() => {
      selesai();
      resolve(null);
    }, detik * 1000);
  });
}

async function rondeLagu(channel: any, a: GuildMember, b: GuildMember): Promise<[GuildMember, GuildMember]> {
  if (laguBank.length === 0) {
    const menang = Math.random() < 0.5 ? a : b;
    return [menang, menang === a ? b : a];
  }
  const pilih = laguBank[Math.floor(Math.random() * laguBank.length)];
  const jawaban = pilih.judul
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);
  return rondeKuis(
    channel,
    a,
    b,
    '🎵',
    `# ${pilih.emoji}\n${pilih.tahun} · ${pilih.genre} · ${pilih.penyanyi}`,
    jawaban,
    'Tebak judulnya di chat. Cuma dua orang ini yang dihitung. 40 detik.'
  );
}

async function rondeTrivia(channel: any, a: GuildMember, b: GuildMember): Promise<[GuildMember, GuildMember]> {
  if (soal.length === 0) {
    const menang = Math.random() < 0.5 ? a : b;
    return [menang, menang === a ? b : a];
  }
  const pilih = soal[Math.floor(Math.random() * soal.length)];
  return rondeKuis(
    channel,
    a,
    b,
    '❓',
    pilih.soal,
    pilih.jawaban,
    'Ketik jawabannya di chat. Cuma dua orang ini yang dihitung. 40 detik.'
  );
}

// ============================================================
// Bracket (port jalanin_bracket)
// ============================================================

type FungsiRonde = (channel: any, a: GuildMember, b: GuildMember) => Promise<[GuildMember, GuildMember]>;

async function jalaninBracket(
  client: any,
  guild: any,
  channel: any,
  pesertaIds: string[],
  fungsiRonde: FungsiRonde,
  label: string
) {
  // acak urutan
  for (let i = pesertaIds.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pesertaIds[i], pesertaIds[j]] = [pesertaIds[j], pesertaIds[i]];
  }
  let peserta: GuildMember[] = [];
  for (const id of pesertaIds) {
    const m = await guild.members.fetch(id).catch(() => null);
    if (m) peserta.push(m);
  }

  await channel.send(
    `🏆 **Turnamen ${label} dimulai.** ${peserta.length} peserta:\n` + peserta.map((p) => p.displayName).join(', ')
  );
  let ronde = 1;
  let semifinalis: GuildMember[] = [];
  while (peserta.length > 1) {
    const namaRonde =
      peserta.length === 2 ? 'FINAL' : peserta.length === 4 ? 'SEMIFINAL' : `Ronde ${ronde}`;
    await channel.send(`**── ${namaRonde} ──**`);
    if (peserta.length === 4) semifinalis = [...peserta];
    const lolos: GuildMember[] = [];
    if (peserta.length % 2) {
      const beruntung = peserta.pop()!;
      lolos.push(beruntung);
      await channel.send(`🎟️ **${beruntung.displayName}** dapet bye, langsung lolos.`);
    }
    for (let i = 0; i < peserta.length; i += 2) {
      const a = peserta[i];
      const b = peserta[i + 1];
      const [menang, kalah] = await fungsiRonde(channel, a, b);
      lolos.push(menang);
      await catatMain(menang.id, 'turnamen', true);
      await catatMain(kalah.id, 'turnamen');
      await prisma.user.update({ where: { id: menang.id }, data: { menang: { increment: 1 } } }).catch(() => {});
      await prisma.user.update({ where: { id: kalah.id }, data: { kalah: { increment: 1 } } }).catch(() => {});
      await new Promise((r) => setTimeout(r, 2000));
    }
    peserta = lolos;
    ronde += 1;
  }
  const juara = peserta[0];
  await beriXp(client, guild, juara.id, TURNAMEN_HADIAH[0]);
  const isi = new EmbedBuilder()
    .setColor(WARNA)
    .setTitle(`🏆  JUARA TURNAMEN ${label.toUpperCase()}`)
    .setDescription(`# ${juara.toString()}\nDapet **${TURNAMEN_HADIAH[0]} XP**.`)
    .setThumbnail(juara.displayAvatarURL());
  const hiburan = semifinalis.filter((p) => p.id !== juara.id);
  if (hiburan.length > 0) {
    for (const p of hiburan) {
      await beriXp(client, guild, p.id, TURNAMEN_HADIAH[2]);
    }
    isi.addFields({
      name: 'Sampai semifinal',
      value: hiburan.map((p) => p.displayName).join(', ') + ` — masing masing ${TURNAMEN_HADIAH[2]} XP`,
      inline: false
    });
  }
  await channel.send({ embeds: [isi] });
}

// ============================================================
// /turnamen (port DaftarTurnamen + cmd_turnamen)
// ============================================================

interface SesiDaftar {
  pembuatId: string;
  label: string;
  pesertaIds: string[];
  mulaiDiminta: boolean;
}

export const turnamenCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('turnamen')
    .setDescription('Bikin turnamen sistem gugur')
    .addStringOption((o) =>
      o
        .setName('jenis')
        .setDescription('Turnamen apa')
        .addChoices(
          { name: 'Suit', value: 'suit' },
          { name: 'Trivia', value: 'trivia' },
          { name: 'Tebak Lagu', value: 'lagu' }
        )
    ) as SlashCommandBuilder,

  executeSlash: async (interaction: ChatInputCommandInteraction) => {
    if (!(await diArena(interaction))) return;
    if (turnamenJalan.has(interaction.channelId)) {
      await interaction.reply({ content: 'Masih ada turnamen yang jalan di sini.', ephemeral: true });
      return;
    }
    const kode = interaction.options.getString('jenis') ?? 'suit';
    const GAME_LABEL: Record<string, string> = { suit: 'Suit', trivia: 'Trivia' };
    const GAME_RONDE: Record<string, FungsiRonde> = { suit: mainSatuRonde, trivia: rondeTrivia };
    const label = GAME_LABEL[kode] ?? 'Tebak Lagu';
    const fungsiRonde: FungsiRonde = GAME_RONDE[kode] ?? rondeLagu;

    turnamenJalan.add(interaction.channelId);
    try {
      const keadaan: SesiDaftar = { pembuatId: interaction.user.id, label, pesertaIds: [], mulaiDiminta: false };
      const sesiId = buatSesi(async (btn, aksi) => {
        if (aksi === 'ikut') {
          const idx = keadaan.pesertaIds.indexOf(btn.user.id);
          if (idx >= 0) {
            keadaan.pesertaIds.splice(idx, 1);
            await btn.reply({ content: 'Oke, lo gua coret.', ephemeral: true });
          } else if (keadaan.pesertaIds.length >= TURNAMEN_MAKS) {
            await btn.reply({ content: `Udah penuh, ${TURNAMEN_MAKS} orang.`, ephemeral: true });
            return;
          } else {
            keadaan.pesertaIds.push(btn.user.id);
            await btn.reply({ content: 'Kedaftar. Pencet lagi kalau mau batal.', ephemeral: true });
          }
          const embedBaru = embedDaftar(keadaan);
          await btn.message.edit({ embeds: [embedBaru] }).catch(() => {});
          return;
        }
        // mulai sekarang
        if (btn.user.id !== keadaan.pembuatId) {
          await btn.reply({ content: 'Cuma yang buka turnamen yang bisa mulai.', ephemeral: true });
          return;
        }
        if (keadaan.pesertaIds.length < TURNAMEN_MIN) {
          await btn.reply({ content: `Minimal ${TURNAMEN_MIN} peserta.`, ephemeral: true });
          return;
        }
        keadaan.mulaiDiminta = true;
        matikanSesi(sesiId!);
        await btn.deferUpdate().catch(() => {});
      }, TURNAMEN_DAFTAR_MENIT * 60);

      function embedDaftar(d: SesiDaftar): EmbedBuilder {
        const isi = new EmbedBuilder()
          .setColor(WARNA)
          .setTitle(`🏆  Turnamen ${d.label} — pendaftaran dibuka`)
          .setDescription(
            `Pencet **Ikut** buat daftar.\nSistem gugur, sekali kalah langsung pulang.\n\n**Peserta (${d.pesertaIds.length}/${TURNAMEN_MAKS})**\n` +
              (d.pesertaIds.length > 0 ? d.pesertaIds.map((id) => `<@${id}>`).join('\n') : '_belum ada yang berani_')
          );
        isi.addFields({
          name: 'Hadiah',
          value: `🥇 ${TURNAMEN_HADIAH[0]} XP · 🥈 ${TURNAMEN_HADIAH[1]} XP · 🥉 ${TURNAMEN_HADIAH[2]} XP`,
          inline: false
        });
        isi.setFooter({ text: `Nutup sendiri ${TURNAMEN_DAFTAR_MENIT} menit lagi` });
        return isi;
      }

      await interaction.reply({
        embeds: [embedDaftar(keadaan)],
        components: barisTombol(tombol('Ikut', '✋', sesiId, 'ikut', 'Primary'), tombol('Mulai Sekarang', '▶️', sesiId, 'mulai', 'Success'))
      });

      await tungguSesiMati(sesiId, TURNAMEN_DAFTAR_MENIT * 60);

      const rows = barisTombol(tombol('Ikut', '✋', sesiId, 'ikut', 'Primary', true), tombol('Mulai Sekarang', '▶️', sesiId, 'mulai', 'Success', true));
      await interaction.editReply({ components: rows }).catch(() => {});

      const pesertaIds = [...keadaan.pesertaIds];
      if (pesertaIds.length < TURNAMEN_MIN) {
        await (interaction.channel as any)?.send(
          `Cuma ${pesertaIds.length} yang daftar, turnamennya batal. Butuh minimal ${TURNAMEN_MIN}.`
        );
        return;
      }
      await jalaninBracket(
        interaction.client,
        interaction.guild,
        interaction.channel as TextChannel,
        pesertaIds,
        fungsiRonde,
        label
      );
    } finally {
      turnamenJalan.delete(interaction.channelId);
    }
  }
};
