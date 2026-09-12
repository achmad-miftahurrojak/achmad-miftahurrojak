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
import {
  WARNA,
  TRIVIA_WAKTU,
  TRIVIA_PETUNJUK,
  TRIVIA_HADIAH,
  TRIVIA_CEPAT,
  TRIVIA_JEDA_ORANG,
  WAKTU_KATEGORI,
  ROLE_SOAL
} from '../config';
import { suara } from '../data/suara';
import { SOAL_BAWAAN, ButirSoal } from '../data/soalBawaan';
import { diArena, beriXp, prisma } from '../gameCore';
import { majuMisi } from './misi';

const BERKAS_SOAL = path.join(process.cwd(), '..', '..', 'data', 'soal-arka.json');

let soal: ButirSoal[] = [];
let rondeGlobal = 0;

interface KeadaanTrivia {
  ronde: number;
  jawaban: string[];
  mulai: number;
  petunjuk: number;
  hadiah: number;
  cepat: number;
}

const triviaJalan = new Map<string, KeadaanTrivia>();
const triviaJeda = new Map<string, number>();

export function muatSoal() {
  try {
    if (fs.existsSync(BERKAS_SOAL)) {
      soal = JSON.parse(fs.readFileSync(BERKAS_SOAL, 'utf-8'));
      for (const butir of soal) butir.kategori = butir.kategori ?? 'umum';
    } else {
      soal = [...SOAL_BAWAAN];
      simpanSoal();
    }
  } catch (err) {
    soal = [...SOAL_BAWAAN];
  }
}

function simpanSoal() {
  fs.writeFileSync(BERKAS_SOAL, JSON.stringify(soal, null, 2), 'utf-8');
}

function samakan(teks: string): string {
  return teks
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function cocok(tulisan: string, daftarJawaban: string[]): boolean {
  const bersih = samakan(tulisan);
  if (!bersih) return false;
  for (const j of daftarJawaban) {
    const jw = samakan(j);
    if (bersih === jw) return true;
    if (new RegExp(`(?<![a-z0-9])${escapeRegex(jw)}(?![a-z0-9])`).test(bersih)) return true;
    const angkaJawaban = jw.replace(/\D/g, '');
    if (angkaJawaban && !/[a-z]/.test(jw)) {
      for (const potong of angkaSaja(tulisan)) {
        if (potong.replace(/\D/g, '') === angkaJawaban) return true;
      }
    }
  }
  return false;
}

function escapeRegex(teks: string): string {
  return teks.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function angkaSaja(teks: string): string[] {
  return teks.replace(/[.,]/g, '').match(/\d[\d\s]*/g) ?? [];
}

function petunjuk(jawaban: string[]): string {
  const utama = jawaban[0];
  const hasil =
    utama[0].toUpperCase() +
    utama
      .slice(1)
      .split('')
      .map((h) => (h === ' ' ? ' ' : '_'))
      .join('');
  return `${hasil}   (${utama.length} huruf)`;
}

/** Dicek dari index.ts tiap ada pesan chat */
export async function cekJawabanTrivia(pesan: Message): Promise<boolean> {
  const keadaan = triviaJalan.get(pesan.channel.id);
  if (!keadaan) return false;
  if (!cocok(pesan.content, keadaan.jawaban)) return false;
  triviaJalan.delete(pesan.channel.id);
  const cepat = Date.now() / 1000 - keadaan.mulai < keadaan.petunjuk;
  const hadiah = keadaan.hadiah + (cepat ? keadaan.cepat : 0);
  await prisma.user.update({ where: { id: pesan.author.id }, data: { menang: { increment: 1 } } }).catch(async () => {
    await prisma.user.upsert({ where: { id: pesan.author.id }, create: { id: pesan.author.id }, update: {} });
    await prisma.user.update({ where: { id: pesan.author.id }, data: { menang: { increment: 1 } } });
  });
  await majuMisi(pesan.author.id, 'trivia', 1, pesan.client);
  await beriXp(pesan.client, pesan.guild, pesan.author.id, hadiah);
  await pesan.react('✅').catch(() => {});
  await (pesan.channel as any).send(
    suara('trivia_bener', { a: pesan.author.displayName, b: keadaan.jawaban[0], x: hadiah })
  );
  return true;
}

export const triviaCommand: Command = {
  data: new SlashCommandBuilder().setName('trivia').setDescription('Soal trivia, jawab langsung di chat') as SlashCommandBuilder,

  executeSlash: async (interaction: ChatInputCommandInteraction) => {
    if (!(await diArena(interaction))) return;
    const tersedia = soal;
    if (tersedia.length === 0) {
      await interaction.reply({ content: 'Gudang soalnya kosong.', ephemeral: true });
      return;
    }
    if (triviaJalan.has(interaction.channelId)) {
      await interaction.reply({ content: 'Masih ada soal yang belum kejawab tuh.', ephemeral: true });
      return;
    }
    const sisa = TRIVIA_JEDA_ORANG - (Date.now() / 1000 - (triviaJeda.get(interaction.user.id) ?? 0));
    if (sisa > 0) {
      await interaction.reply({
        content: `Sabar, **${Math.floor(sisa) + 1} detik** lagi baru boleh minta soal berikutnya. Biar yang lain kebagian mikir.`,
        ephemeral: true
      });
      return;
    }
    triviaJeda.set(interaction.user.id, Date.now() / 1000);
    const ronde = ++rondeGlobal;
    const pilihSoal = tersedia[Math.floor(Math.random() * tersedia.length)];
    const kat = pilihSoal.kategori ?? 'umum';
    const [waktu, petunjukDetik, hadiah, cepatBonus] = WAKTU_KATEGORI[kat] ?? [
      TRIVIA_WAKTU,
      TRIVIA_PETUNJUK,
      TRIVIA_HADIAH,
      TRIVIA_CEPAT
    ];
    triviaJalan.set(interaction.channelId, {
      ronde,
      jawaban: pilihSoal.jawaban,
      mulai: Date.now() / 1000,
      petunjuk: petunjukDetik,
      hadiah,
      cepat: cepatBonus
    });
    const judul = kat === 'hots' ? '🧠 Trivia HOTS' : '❓ Trivia';
    const isi = new EmbedBuilder().setColor(WARNA).setTitle(judul).setDescription(pilihSoal.soal);
    isi.setFooter({
      text:
        `Ketik jawabannya di chat. Waktu ${waktu} detik.` +
        (kat === 'hots' ? '  Soal ini butuh mikir, santai aja.' : '')
    });
    await interaction.reply({ embeds: [isi] });

    setTimeout(async () => {
      const k = triviaJalan.get(interaction.channelId);
      if (k && k.ronde === ronde) {
        await interaction.followUp(`Susah ya? Nih petunjuknya:  \`${petunjuk(pilihSoal.jawaban)}\``);
      }
    }, petunjukDetik * 1000);

    setTimeout(() => {
      const k = triviaJalan.get(interaction.channelId);
      if (k && k.ronde === ronde) {
        triviaJalan.delete(interaction.channelId);
        interaction.followUp(suara('trivia_habis', { b: pilihSoal.jawaban[0] })).catch(() => {});
      }
    }, waktu * 1000);
  }
};

export const tambahSoalCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('tambahsoal')
    .setDescription('Nambah soal trivia baru')
    .addStringOption((o) => o.setName('pertanyaan').setDescription('Soalnya apa').setRequired(true))
    .addStringOption((o) =>
      o
        .setName('jawaban')
        .setDescription('Jawaban yang bener. Pisahin pakai koma kalau boleh lebih dari satu')
        .setRequired(true)
    )
    .addStringOption((o) =>
      o
        .setName('kategori')
        .setDescription('umum buat trivia biasa, lagu buat #guess-the-song')
        .addChoices({ name: 'Umum', value: 'umum' }, { name: 'Lagu', value: 'lagu' })
    ) as SlashCommandBuilder,

  executeSlash: async (interaction: ChatInputCommandInteraction) => {
    if (!(await diArena(interaction))) return;
    if (ROLE_SOAL.length > 0 && interaction.inGuild()) {
      const member = await interaction.guild?.members.fetch(interaction.user.id);
      const punya = new Set(member?.roles.cache.map((r) => r.name) ?? []);
      if (!ROLE_SOAL.some((r) => punya.has(r))) {
        await interaction.reply({
          content: 'Yang boleh nambah soal cuma ' + ROLE_SOAL.join(' atau ') + '.',
          ephemeral: true
        });
        return;
      }
    }
    const pertanyaan = interaction.options.getString('pertanyaan', true).trim();
    const daftar = interaction.options
      .getString('jawaban', true)
      .split(',')
      .map((j) => j.trim())
      .filter(Boolean);
    if (daftar.length === 0) {
      await interaction.reply({ content: 'Jawabannya kosong.', ephemeral: true });
      return;
    }
    const kat = interaction.options.getString('kategori') ?? 'umum';
    soal.push({ soal: pertanyaan, jawaban: daftar, kategori: kat });
    simpanSoal();
    await interaction.reply(
      `Soal ke-${soal.length} masuk gudang, kategori **${kat}**.\n**${pertanyaan}**\nJawaban: ${daftar.join(', ')}`
    );
  }
};

export const daftarSoalCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('daftarsoal')
    .setDescription('Liat berapa soal yang ada') as SlashCommandBuilder,

  executeSlash: async (interaction: ChatInputCommandInteraction) => {
    if (!(await diArena(interaction))) return;
    const hitung: Record<string, number> = {};
    for (const butir of soal) {
      const k = butir.kategori ?? 'umum';
      hitung[k] = (hitung[k] ?? 0) + 1;
    }
    const rincian = Object.entries(hitung)
      .sort()
      .map(([k, v]) => `  ${k}: **${v}** soal`)
      .join('\n');
    await interaction.reply({ content: `Gudang soal isinya **${soal.length}** soal.\n${rincian}`, ephemeral: true });
  }
};

export { cocok, soal };
