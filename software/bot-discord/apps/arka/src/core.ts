import { Client, ActivityType, GuildMember, TextChannel } from 'discord.js';
import { PrismaClient, User, ArkaUser, ArkaGlobal } from '@hamin/database';
import { logger } from '@hamin/utils';
import {
  CUACA,
  TINGKAT,
  PET_AKTIF,
  PET_SUASANA,
  PET_LAPAR_PER_JAM,
  COMEBACK_AKTIF,
  COMEBACK_HARI,
  COMEBACK_XP,
  COMEBACK_PENGALI,
  COMEBACK_JAM,
  KABAR_HAMPIR,
  HAMPIR_AMBANG,
  PAUS_TAMBAHAN
} from './config';

const STATUS_LIST = [
  'Berani nantangin gua?',
  'Lagi nunggu lawan sepadan...',
  'Jangan lupa absen woy!',
  'Ayo mabar grinding level!'
];

let globalPrisma: PrismaClient;
let statusIdx = 0;

export function initCore(client: Client, prisma: PrismaClient) {
  globalPrisma = prisma;
  logger.info('[arka] Core initialized');
}

export function gantiStatus(client: Client) {
  if (!client.user) return;
  const status = STATUS_LIST[statusIdx % STATUS_LIST.length];
  client.user.setActivity({ name: status, type: ActivityType.Custom });
  statusIdx++;
}

export function tingkat(xp: number) {
  for (let i = TINGKAT.length - 1; i >= 0; i--) {
    if (xp >= (TINGKAT[i][0] as number)) return TINGKAT[i];
  }
  return TINGKAT[0];
}

export function berikutnya(xp: number) {
  for (const t of TINGKAT) {
    if (xp < (t[0] as number)) return t;
  }
  return null;
}

export async function getArkaGlobal() {
  let g = await globalPrisma.arkaGlobal.findUnique({ where: { id: 1 } });
  if (!g) {
    g = await globalPrisma.arkaGlobal.create({ data: { id: 1 } });
  }
  return g;
}

export async function cuacaHariIni() {
  const hariIni = new Date().toISOString().split('T')[0];
  const g = await getArkaGlobal();

  if (g.cuacaTanggal !== hariIni) {
    const weights = CUACA.map(c => c[1] as number);
    const totalWeight = weights.reduce((a, b) => a + b, 0);
    let rand = Math.random() * totalWeight;
    let selected: readonly [number | string, number, string, string] = CUACA[0];
    
    for (let i = 0; i < CUACA.length; i++) {
      if (rand < weights[i]) {
        selected = CUACA[i];
        break;
      }
      rand -= weights[i];
    }

    const updated = await globalPrisma.arkaGlobal.update({
      where: { id: 1 },
      data: {
        cuacaTanggal: hariIni,
        cuacaNama: selected[0] as string,
        cuacaKali: selected[1] as number,
        cuacaEmoji: selected[2] as string,
        cuacaKata: selected[3] as string,
        cuacaDiumumkan: false
      }
    });
    return updated;
  }
  return g;
}

export function suasanaPet(kenyang: number) {
  for (const s of PET_SUASANA) {
    if (kenyang >= (s[0] as number)) return { nama: s[1], emoji: s[2], kali: s[3] as number };
  }
  return { nama: PET_SUASANA[PET_SUASANA.length - 1][1], emoji: PET_SUASANA[PET_SUASANA.length - 1][2], kali: PET_SUASANA[PET_SUASANA.length - 1][3] as number };
}

export async function kondisiPet() {
  const g = await getArkaGlobal();
  const sekarang = new Date();
  const laluMs = sekarang.getTime() - g.petTerakhir.getTime();
  const jam = laluMs / (1000 * 3600);
  
  const baruKenyang = Math.max(0.0, g.petKenyang - jam * PET_LAPAR_PER_JAM);
  
  return await globalPrisma.arkaGlobal.update({
    where: { id: 1 },
    data: {
      petKenyang: baruKenyang,
      petTerakhir: sekarang
    }
  });
}

export async function tambahXp(client: Client, member: GuildMember, jumlah: number) {
  if (member.user.bot) return;

  const user = await globalPrisma.user.upsert({
    where: { id: member.id },
    create: { id: member.id },
    update: {}
  });

  const arkaUser = await globalPrisma.arkaUser.upsert({
    where: { userId: member.id },
    create: { userId: member.id },
    update: {}
  });

  const efek: any = arkaUser.efek || {};
  if (efek.beku_sampai && new Date(efek.beku_sampai) > new Date()) return;

  const hariIni = new Date().toISOString().split('T')[0];
  const lama = tingkat(user.xp)[1];
  const cuaca = await cuacaHariIni();
  
  let dapat = Math.max(1, Math.floor(jumlah * (cuaca.cuacaKali || 1)));

  if (PET_AKTIF) {
    const pet = await getArkaGlobal();
    dapat = Math.max(1, Math.floor(dapat * suasanaPet(pet.petKenyang).kali));
  }

  let pengaliComeback = 1.0;
  if (efek.comeback_sampai && new Date(efek.comeback_sampai) > new Date()) {
    pengaliComeback = COMEBACK_PENGALI;
  }
  dapat = Math.max(1, Math.floor(dapat * pengaliComeback));

  if (efek.paus_sampai && new Date(efek.paus_sampai) > new Date()) {
    dapat = Math.floor(dapat * (1 + PAUS_TAMBAHAN));
  }

  const newXp = user.xp + dapat;
  
  await globalPrisma.user.update({
    where: { id: member.id },
    data: {
      xp: { increment: dapat },
      xpMinggu: { increment: dapat }
    }
  });

  const baru = tingkat(newXp);
  if (baru[1] !== lama) {
    const arenaId = process.env.ARKA_CHANNEL_ARENA;
    if (arenaId) {
      const channel = client.channels.cache.get(arenaId) as TextChannel;
      if (channel) {
        channel.send(`🌊 ${member.toString()} baru aja naik tingkat jadi **${baru[1]}**!`).catch(() => {});
      }
    }
    
    if (baru[2]) {
      const roleBaru = member.guild.roles.cache.find(r => r.name === baru[2]);
      if (roleBaru && !member.roles.cache.has(roleBaru.id)) {
        await member.roles.add(roleBaru, 'Naik tingkat').catch(() => {});
      }
      const semuaTingkat = new Set(TINGKAT.map(t => String(t[2])).filter(Boolean));
      const namaTingkatBaru = String(baru[2]);
      const lamaDipakai = member.roles.cache.filter(r => semuaTingkat.has(r.name) && r.name !== namaTingkatBaru);
      if (lamaDipakai.size > 0) {
        await member.roles.remove(lamaDipakai, 'Tingkat lama').catch(() => {});
      }
    }
  }

  // kabari_hampir: DM ketika XP mendekati level berikutnya
  const next = berikutnya(newXp);
  if (next && (next[0] as number) - newXp <= HAMPIR_AMBANG && newXp < (next[0] as number)) {
    const arkaUser = await globalPrisma.arkaUser.upsert({ where: { userId: member.id }, create: { userId: member.id }, update: {} });
    const efek: any = arkaUser.efek || {};
    if (!efek.hampir_dikabarin || efek.hampir_dikabarin !== hariIni) {
      efek.hampir_dikabarin = hariIni;
      await globalPrisma.arkaUser.update({ where: { userId: member.id }, data: { efek } as any });
      member.send(`Tinggal **${(next[0] as number) - newXp} XP** lagi naik ke **${next[1]}**. Dikit lagi!`).catch(() => {});
    }
  }
}
