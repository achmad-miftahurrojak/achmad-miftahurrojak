import {
  ChatInputCommandInteraction,
  Client,
  ButtonInteraction,
  ButtonBuilder,
  ActionRowBuilder,
  ButtonStyle,
  InteractionResponse,
  Message,
  GuildMember
} from 'discord.js';
import { logger } from '@hamin/utils';
import { CHANNEL_PERINTAH, CHANNEL_ARENA } from './config';
import prisma from './prisma';

export { prisma };

// ============================================================
// Channel restriction (port dari core.di_arena)
// ============================================================

export async function diArena(inter: ChatInputCommandInteraction): Promise<boolean> {
  const nama = inter.commandName;
  const tujuan = CHANNEL_PERINTAH[nama];
  if (!tujuan || tujuan === 'semua') return true;
  if (tujuan.includes(inter.channelId)) return true;
  const kemana = tujuan.map((c) => `<#${c}>`).join(' atau ');
  await inter.reply({
    content: `\`/${nama}\` mainnya di ${kemana} ya, biar sini ga penuh.`,
    ephemeral: true
  });
  return false;
}

// ============================================================
// Akses data pemain (ArkaUser.game JSON)
// ============================================================

export interface GamePerGame {
  main?: number;
  minggu?: number;
  menang?: number;
}

export async function getArkaUser(userId: string) {
  await prisma.user.upsert({ where: { id: userId }, create: { id: userId }, update: {} });
  return prisma.arkaUser.upsert({ where: { userId }, create: { userId }, update: {} });
}

function mingguIni() {
  const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }));
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const yearStart = new Date(d.getFullYear(), 0, 1);
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

/** Catat satu kali main game. menang=true buat kemenangan. */
export async function catatMain(userId: string, game: string, menang = false) {
  const arkaUser = await getArkaUser(userId);
  const semua: Record<string, GamePerGame> = (arkaUser.game as any) ?? {};
  const perGame = semua[game] ?? {};
  perGame.main = (perGame.main ?? 0) + 1;
  const minggu = perGame.minggu ?? {};
  // simpan hitungan mingguan sebagai angka tunggal dengan penanda minggu terpisah
  const semuaGame: Record<string, any> = semua;
  semuaGame[game] = {
    ...perGame,
    ...(menang ? { menang: (perGame.menang ?? 0) + 1 } : {}),
    mingguKunci: mingguIni(),
    mingguMain: ((perGame as any).mingguKunci === mingguIni() ? (perGame as any).mingguMain ?? 0 : 0) + 1
  };
  delete (semuaGame[game] as any).minggu;
  await prisma.arkaUser.update({ where: { userId }, data: { game: semuaGame } as any });
}

/** Tambah/mengurangi XP langsung (di luar tambah_xp normal), untuk duel taruhan. */
export async function ubahXpLangsung(userId: string, selisih: number) {
  await prisma.user.upsert({ where: { id: userId }, create: { id: userId }, update: {} });
  // ponytail: negative increment not clamped by DB — caller must ensure xp >= 0
  const updated = await prisma.user.update({ where: { id: userId }, data: { xp: { increment: selisih } }, select: { xp: true } });
  return Math.max(0, updated.xp);
}

export async function ambilBarang(userId: string): Promise<Record<string, number>> {
  const arkaUser = await getArkaUser(userId);
  return ((arkaUser.barang as any) ?? {}) as Record<string, number>;
}

export async function simpanBarang(userId: string, barang: Record<string, number>) {
  await prisma.arkaUser.update({ where: { userId }, data: { barang } as any });
}

export async function ambilEfek(userId: string): Promise<Record<string, any>> {
  const arkaUser = await getArkaUser(userId);
  return ((arkaUser.efek as any) ?? {}) as Record<string, any>;
}

export async function simpanEfek(userId: string, efek: Record<string, any>) {
  await prisma.arkaUser.update({ where: { userId }, data: { efek } as any });
}

export async function beriXp(
  client: Client,
  guild: { members: { fetch: (id: string) => Promise<GuildMember> } } | null,
  userId: string,
  jumlah: number
) {
  try {
    let member: GuildMember | null = null;
    if (guild) member = await guild.members.fetch(userId).catch(() => null);
    const { tambahXp } = await import('./core');
    if (member) {
      await tambahXp(client, member, jumlah);
    } else {
      // fallback: cuma nambah angka kalau member ga ketemu
      const user = await prisma.user.upsert({ where: { id: userId }, create: { id: userId }, update: {} });
      await prisma.user.update({ where: { id: userId }, data: { xp: { increment: jumlah }, xpMinggu: { increment: jumlah } } });
    }
  } catch (err) {
    logger.error(err, `[gameCore] beriXp gagal buat ${userId}`);
  }
}

// ============================================================
// Router komponen tombol sementara (pengganti discord.ui.View)
// customId format: gk|<sesi>|<aksi>
// ============================================================

type KomponenHandler = (inter: ButtonInteraction, aksi: string) => void | Promise<void>;

interface SesiKomponen {
  handler: KomponenHandler;
  timer?: NodeJS.Timeout;
}

const sesiAktif = new Map<string, SesiKomponen>();
export { sesiAktif };
let counterSesi = 0;

export function buatSesi(handler: KomponenHandler, timeoutDetik: number): string {
  const sesi = `s${++counterSesi}`;
  const entry: SesiKomponen = { handler };
  entry.timer = setTimeout(() => matikanSesi(sesi), timeoutDetik * 1000);
  sesiAktif.set(sesi, entry);
  return sesi;
}

export function matikanSesi(sesi: string) {
  const entry = sesiAktif.get(sesi);
  if (entry?.timer) clearTimeout(entry.timer);
  sesiAktif.delete(sesi);
}

/** Reset timer sesi tanpa mematikannya (buat fase lanjutan seperti tebakan). */
export function perpanjangSesi(sesi: string, timeoutDetik: number) {
  const entry = sesiAktif.get(sesi);
  if (!entry) return;
  if (entry.timer) clearTimeout(entry.timer);
  entry.timer = setTimeout(() => matikanSesi(sesi), timeoutDetik * 1000);
}

export function tombol(
  label: string,
  emoji: string,
  sesi: string,
  aksi: string,
  style: keyof typeof ButtonStyle = 'Secondary',
  disabled = false
): ButtonBuilder {
  return new ButtonBuilder()
    .setCustomId(`gk|${sesi}|${aksi}`)
    .setLabel(label)
    .setEmoji(emoji)
    .setStyle(ButtonStyle[style])
    .setDisabled(disabled);
}

export function barisTombol(...tombols: ButtonBuilder[]): ActionRowBuilder<ButtonBuilder>[] {
  const row = new ActionRowBuilder<ButtonBuilder>();
  row.addComponents(...tombols);
  return [row];
}

/** Kirim pesan ke channel apa pun yang bisa kirim (hindari PartialGroupDM typing). */
export function kirimKe(channel: any, isi: any) {
  return channel.send(isi);
}

export async function jalankanKomponen(inter: ButtonInteraction): Promise<boolean> {
  if (!inter.customId.startsWith('gk|')) return false;
  const [, sesi, aksi] = inter.customId.split('|');
  const entry = sesiAktif.get(sesi);
  if (!entry) {
    await inter.reply({ content: 'Sesi ini udah habis.', ephemeral: true }).catch(() => {});
    return true;
  }
  await entry.handler(inter, aksi);
  return true;
}

// ============================================================
// Util umum
// ============================================================

export function pilih<T>(daftar: T[]): T {
  return daftar[Math.floor(Math.random() * daftar.length)];
}

export function tunggu(detik: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, detik * 1000));
}

export type PesanBalasan = InteractionResponse | Message;
