import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  Message,
  EmbedBuilder,
  TextBasedChannel
} from 'discord.js';
import * as fs from 'fs';
import * as path from 'path';
import { Command } from '../handler';
import { WARNA, LAGU_JEDA_TAHAP, LAGU_HADIAH, LAGU_JEDA_ORANG, ROLE_SOAL } from '../config';
import { LAGU_BAWAAN, ButirLagu } from '../data/laguBawaan';
import { diArena, beriXp, catatMain, prisma } from '../gameCore';
import { cocok } from './trivia';

const BERKAS_LAGU = path.join(process.cwd(), '..', '..', 'data', 'soal-lagu.json');

export let laguBank: ButirLagu[] = [];
let rondeGlobal = 0;

interface KeadaanLagu {
  ronde: number;
  jawaban: string[];
  tahap: number;
  lagu: ButirLagu;
}

const laguJalan = new Map<string, KeadaanLagu>();
const laguJeda = new Map<string, number>();

export function muatLagu() {
  try {
    if (fs.existsSync(BERKAS_LAGU)) {
      laguBank = JSON.parse(fs.readFileSync(BERKAS_LAGU, 'utf-8'));
    } else {
      laguBank = [...LAGU_BAWAAN];
      simpanLagu();
    }
  } catch (err) {
    laguBank = [...LAGU_BAWAAN];
  }
}

function simpanLagu() {
  fs.writeFileSync(BERKAS_LAGU, JSON.stringify(laguBank, null, 2), 'utf-8');
}

function polaJudul(judul: string): string {
  return judul
    .split(' ')
    .map((kata) => (kata.length <= 1 ? kata.toUpperCase() : kata[0].toUpperCase() + '_'.repeat(kata.length - 1)))
    .join(' ');
}

function embedLagu(pilih: ButirLagu, tahap: number): EmbedBuilder {
  const isi = new EmbedBuilder()
    .setColor(WARNA)
    .setTitle('🎵  Tebak Lagu')
    .setDescription(`# ${pilih.emoji}\nTebak judul lagunya. Ketik langsung di chat.`);
  if (tahap >= 1) {
    isi.addFields({ name: 'Petunjuk 2 — kapan & apa', value: `Rilis **${pilih.tahun}** · ${pilih.genre}`, inline: false });
  }
  if (tahap >= 2) {
    isi.addFields({ name: 'Petunjuk 3 — siapa', value: `Dinyanyiin **${pilih.penyanyi}**`, inline: false });
  }
  if (tahap >= 3) {
    const judulUtama = pilih.judul.split(',')[0].trim();
    isi.addFields({ name: 'Petunjuk 4 — pola judul', value: `\`${polaJudul(judulUtama)}\``, inline: false });
  }
  const hadiah = LAGU_HADIAH[Math.min(tahap, LAGU_HADIAH.length - 1)];
  const sisa = LAGU_HADIAH.length - 1 - tahap;
  isi.setFooter({
    text:
      `Jawab sekarang dapet ${hadiah} XP` +
      (sisa > 0 ? ' · ' + sisa + ' petunjuk lagi, tiap petunjuk XP-nya turun' : ' · ini petunjuk terakhir')
  });
  return isi;
}

/** Dicek dari index.ts tiap ada pesan chat */
export async function cekJawabanLagu(pesan: Message): Promise<boolean> {
  const keadaan = laguJalan.get(pesan.channel.id);
  if (!keadaan) return false;
  if (!cocok(pesan.content, keadaan.jawaban)) return false;
  laguJalan.delete(pesan.channel.id);
  const tahap = keadaan.tahap;
  const hadiah = LAGU_HADIAH[Math.min(tahap, LAGU_HADIAH.length - 1)];
  const lagu = keadaan.lagu;
  await catatMain(pesan.author.id, 'lagu', true);
  await prisma.user.update({ where: { id: pesan.author.id }, data: { menang: { increment: 1 } } }).catch(async () => {
    await prisma.user.upsert({ where: { id: pesan.author.id }, create: { id: pesan.author.id }, update: {} });
    await prisma.user.update({ where: { id: pesan.author.id }, data: { menang: { increment: 1 } } });
  });
  await beriXp(pesan.client, pesan.guild, pesan.author.id, hadiah);
  await pesan.react('🎵').catch(() => {});
  const cepat = tahap === 0 ? '  Ketebak dari emoji doang, gila.' : '';
  await (pesan.channel as any).send(
    `🎵 **${pesan.author.displayName}** bener! **${keadaan.jawaban[0]}** — ${lagu.penyanyi} (${lagu.tahun}). Ambil **${hadiah} XP**.${cepat}`
  );
  return true;
}

export const laguCommand: Command = {
  data: new SlashCommandBuilder().setName('lagu').setDescription('Tebak lagu dari emoji, petunjuknya nambah pelan pelan') as SlashCommandBuilder,

  executeSlash: async (interaction: ChatInputCommandInteraction) => {
    if (!(await diArena(interaction))) return;
    if (laguBank.length === 0) {
      await interaction.reply({ content: 'Gudang lagunya kosong. Tambahin pakai `/tambahlagu`.', ephemeral: true });
      return;
    }
    if (laguJalan.has(interaction.channelId)) {
      await interaction.reply({ content: 'Masih ada lagu yang belum ketebak tuh.', ephemeral: true });
      return;
    }
    const sisa = LAGU_JEDA_ORANG - (Date.now() / 1000 - (laguJeda.get(interaction.user.id) ?? 0));
    if (sisa > 0) {
      await interaction.reply({ content: `Sabar, **${Math.floor(sisa) + 1} detik** lagi.`, ephemeral: true });
      return;
    }
    laguJeda.set(interaction.user.id, Date.now() / 1000);
    const ronde = ++rondeGlobal;
    const pilih = laguBank[Math.floor(Math.random() * laguBank.length)];
    const jawaban = pilih.judul
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean);
    laguJalan.set(interaction.channelId, { ronde, jawaban, tahap: 0, lagu: pilih });
    await interaction.reply({ embeds: [embedLagu(pilih, 0)] });

    for (let tahap = 1; tahap < LAGU_HADIAH.length; tahap++) {
      await new Promise((r) => setTimeout(r, LAGU_JEDA_TAHAP * 1000));
      const k = laguJalan.get(interaction.channelId);
      if (!k || k.ronde !== ronde) return;
      k.tahap = tahap;
      await interaction.followUp({ embeds: [embedLagu(pilih, tahap)] });
    }
    await new Promise((r) => setTimeout(r, LAGU_JEDA_TAHAP * 1000));
    const k = laguJalan.get(interaction.channelId);
    if (k && k.ronde === ronde) {
      laguJalan.delete(interaction.channelId);
      await interaction.followUp(
        `⏰ Ga ada yang tau. Jawabannya **${jawaban[0]}** — ${pilih.penyanyi} (${pilih.tahun}).`
      );
    }
  }
};

export const tambahLaguCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('tambahlagu')
    .setDescription('Nambah lagu ke gudang tebak lagu')
    .addStringOption((o) =>
      o.setName('judul').setDescription('Judul lagunya. Pisahin pakai koma kalau ada nama lain').setRequired(true)
    )
    .addStringOption((o) => o.setName('penyanyi').setDescription('Yang nyanyi').setRequired(true))
    .addIntegerOption((o) => o.setName('tahun').setDescription('Tahun rilis').setRequired(true))
    .addStringOption((o) => o.setName('genre').setDescription('Genrenya apa').setRequired(true))
    .addStringOption((o) =>
      o.setName('emoji').setDescription('Emoji yang nggambarin judulnya, 2 sampai 4 biji').setRequired(true)
    ) as SlashCommandBuilder,

  executeSlash: async (interaction: ChatInputCommandInteraction) => {
    if (!(await diArena(interaction))) return;
    if (ROLE_SOAL.length > 0 && interaction.inGuild()) {
      const member = await interaction.guild?.members.fetch(interaction.user.id);
      const punya = new Set(member?.roles.cache.map((r) => r.name) ?? []);
      if (!ROLE_SOAL.some((r) => punya.has(r))) {
        await interaction.reply({
          content: 'Nambah lagu cuma buat ' + ROLE_SOAL.join(' atau ') + '.',
          ephemeral: true
        });
        return;
      }
    }
    const judul = interaction.options.getString('judul', true);
    const penyanyi = interaction.options.getString('penyanyi', true);
    const tahun = interaction.options.getInteger('tahun', true);
    const genre = interaction.options.getString('genre', true);
    const emoji = interaction.options.getString('emoji', true);

    const utama = judul.split(',')[0].trim().toLowerCase();
    if (laguBank.some((l) => l.judul.split(',')[0].trim().toLowerCase() === utama)) {
      await interaction.reply({
        content: `**${judul.split(',')[0].trim()}** udah ada di gudang.`,
        ephemeral: true
      });
      return;
    }
    if (tahun < 1900 || tahun > new Date().getFullYear()) {
      await interaction.reply({ content: 'Tahunnya ga masuk akal.', ephemeral: true });
      return;
    }
    laguBank.push({ judul, penyanyi, tahun, genre, emoji });
    simpanLagu();
    const isi = new EmbedBuilder()
      .setColor(WARNA)
      .setTitle('🎵  Lagu ditambahin')
      .setDescription(`# ${emoji}\n**${judul}**`)
      .addFields(
        { name: 'Penyanyi', value: penyanyi, inline: true },
        { name: 'Tahun', value: String(tahun), inline: true },
        { name: 'Genre', value: genre, inline: true },
        { name: 'Pola judul', value: `\`${polaJudul(judul.split(',')[0].trim())}\``, inline: false }
      )
      .setFooter({ text: `Gudang lagu sekarang ${laguBank.length} judul` });
    await interaction.reply({ embeds: [isi], ephemeral: true });
  }
};
