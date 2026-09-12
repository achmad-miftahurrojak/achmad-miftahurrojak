import { Client, Message, EmbedBuilder, Guild, TextChannel } from 'discord.js';
import { logger } from '@hamin/utils';
import prisma from './prisma';
import {
  WARNA, TINGKAT, RANTAI_HURUF_MIN, RANTAI_XP, RANTAI_XP_REKOR,
  MINIMAL_HURUF, XP_CHAT, JEDA_CHAT_MS, XP_VOICE, JEDA_VOICE_MS,
  PET_AKTIF, PET_KENYANG_PER_CHAT,
  HARI_REKAP, JAM_REKAP, ROLE_JUARA, KATEGORI_GAME, NAMA_GAME,
  JAM_CUACA, CHANNEL_CUACA, CHANNEL_REKAP, CHANNEL_ARENA, CHANNEL_RANTAI,
  JAM_MISI, CHANNEL_MISI, MISI_BONUS,
  QUEST_AKTIF, QUEST_BONUS, CHANNEL_QUEST,
  JAM_TOKO, CHANNEL_TOKO, WISHLIST_AKTIF,
  SEASON_AKTIF, SEASON_BULAN, SEASON_JUARA_DISIMPAN, SEASON_SISA_PERSEN,
  KAPSUL_AKTIF, KAPSUL_JAM_BUKA,
  COMEBACK_AKTIF, COMEBACK_HARI, COMEBACK_XP, COMEBACK_PENGALI, COMEBACK_JAM
} from './config';
import { tambahXp, tingkat, getArkaGlobal, kondisiPet, cuacaHariIni } from './core';
import { catatMain } from './gameCore';
import { majuMisi, misiHariIni, questSekarang } from './commands/misi';
import { stokToko, embedToko, cariBarang } from './commands/toko';



function sekarangWib() {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }));
}

function hariIniWib() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
}

function mingguIniWib() {
  const d = sekarangWib();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const yearStart = new Date(d.getFullYear(), 0, 1);
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

function channelTek(client: Client, id?: string): TextChannel | null {
  if (!id) return null;
  const ch = client.channels.cache.get(id);
  return (ch as TextChannel) ?? null;
}

// ============================================================
// Rantai Kata (event messageCreate)
// ============================================================

function kataSah(teks: string): string | null {
  const bersih = teks.trim().toLowerCase();
  if (bersih.length < RANTAI_HURUF_MIN) return null;
  if (!/^[a-zA-Z]+$/.test(bersih)) return null;
  return bersih;
}

export async function cekRantai(client: Client, pesan: Message): Promise<boolean> {
  const chRantai = process.env.ARKA_CHANNEL_RANTAI || undefined;
  if (!CHANNEL_RANTAI || pesan.channel.id !== (chRantai ?? CHANNEL_RANTAI)) return false;
  const kata = kataSah(pesan.content);
  if (!kata) return false;

  const global = await getArkaGlobal();
  const rantai: any = (global as any).rantai ?? { terakhir: '', dipakai: [], panjang: 0, rekor: 0, orang_terakhir: 0 };
  rantai.dipakai = rantai.dipakai ?? [];

  if (rantai.panjang && pesan.author.id === rantai.orang_terakhir) {
    await pesan.react('🔁').catch(() => {});
    return true;
  }

  const saluran = pesan.channel as TextChannel;

  const putus = async (alasan: string) => {
    await saluran.send(`${alasan}\nMulai lagi dari kata bebas.` + (rantai.rekor ? `\nRekor masih **${rantai.rekor}** kata.` : ''));
    rantai.terakhir = '';
    rantai.dipakai = [];
    rantai.panjang = 0;
    rantai.orang_terakhir = 0;
    await prisma.arkaGlobal.update({ where: { id: 1 }, data: { rantai } as any });
  };

  if (rantai.terakhir) {
    const harus = rantai.terakhir[rantai.terakhir.length - 1];
    if (kata[0] !== harus) {
      await pesan.react('❌').catch(() => {});
      await putus(`Putus di **${rantai.panjang}** kata. Harusnya diawali huruf **${harus.toUpperCase()}**, bukan **${kata[0].toUpperCase()}**.`);
      return true;
    }
  }
  if (rantai.dipakai.includes(kata)) {
    await pesan.react('♻️').catch(() => {});
    await putus(`**${kata}** udah kepakai di rantai ini. Putus di **${rantai.panjang}** kata.`);
    return true;
  }

  rantai.terakhir = kata;
  rantai.dipakai.push(kata);
  rantai.panjang += 1;
  rantai.orang_terakhir = pesan.author.id;
  let hadiah = RANTAI_XP;
  const rekorBaru = rantai.panjang > (rantai.rekor ?? 0);
  if (rekorBaru) {
    rantai.rekor = rantai.panjang;
    hadiah += RANTAI_XP_REKOR;
  }
  await catatMain(pesan.author.id, 'rantai', true);
  if (pesan.member) await tambahXp(client, pesan.member, hadiah);
  await pesan.react('✅').catch(() => {});
  if (rekorBaru && rantai.panjang > 5) {
    await saluran.send(`🎉 **REKOR BARU: ${rantai.panjang} kata!** ${pesan.author.displayName} dapet bonus **${RANTAI_XP_REKOR} XP**. Lanjut, jangan putus.`);
  } else if (rantai.panjang % 10 === 0) {
    await saluran.send(`**${rantai.panjang} kata** tanpa putus. Rekornya ${rantai.rekor}. Hati hati.`);
  }
  await prisma.arkaGlobal.update({ where: { id: 1 }, data: { rantai } as any });
  return true;
}

// ============================================================
// XP chat (event messageCreate)
// ============================================================

const jedaTerakhir = new Map<string, number>();

function bersihkanJedaTerakhir() {
  const sekarang = Date.now();
  for (const [kunci, waktu] of jedaTerakhir.entries()) {
    if (sekarang - waktu > 120_000) jedaTerakhir.delete(kunci);
  }
}

export async function chatXp(client: Client, pesan: Message) {
  if (!pesan.guild || !pesan.member) return;
  if (pesan.content.trim().length < MINIMAL_HURUF) return;
  const kunci = pesan.author.id;
  const sekarang = Date.now();
  if (sekarang - (jedaTerakhir.get(kunci) ?? 0) < JEDA_CHAT_MS) return;
  jedaTerakhir.set(kunci, sekarang);

  if (PET_AKTIF) {
    const pet = await kondisiPet();
    const baruKenyang = Math.min(100.0, pet.petKenyang + PET_KENYANG_PER_CHAT);
    await prisma.arkaGlobal.update({ where: { id: 1 }, data: { petKenyang: baruKenyang } });
  }

  await prisma.user.upsert({ where: { id: pesan.author.id }, create: { id: pesan.author.id }, update: {} });
  const user = await prisma.user.findUnique({ where: { id: pesan.author.id } });

  // Comeback bonus detection
  if (COMEBACK_AKTIF && user?.lastActive) {
    const inactiveDays = (sekarang - user.lastActive.getTime()) / 86400000;
    if (inactiveDays >= COMEBACK_HARI) {
      const bonusXp = COMEBACK_XP + Math.floor(Math.random() * 100);
      await tambahXp(client, pesan.member, bonusXp);
      const efek: any = JSON.parse(JSON.stringify(await prisma.arkaUser.findUnique({ where: { userId: pesan.author.id } }).then(a => a?.efek ?? {})));
      efek.comeback_mult = COMEBACK_PENGALI;
      efek.comeback_sampai = new Date(sekarang + COMEBACK_JAM * 3600000).toISOString();
      await prisma.arkaUser.upsert({ where: { userId: pesan.author.id }, create: { userId: pesan.author.id, efek }, update: { efek } });
      const saluran = pesan.channel as TextChannel;
      saluran.send(`🎉 **${pesan.author.displayName}** balik lagi! ${inactiveDays >= 365 ? 'Setahun lebih ilang — ' : ''}Dapet **${bonusXp} XP** bonus comeback + **x${COMEBACK_PENGALI}** XP selama ${COMEBACK_JAM} jam.`).catch(() => {});
      logger.info(`[comeback] ${pesan.author.id} balik setelah ${Math.round(inactiveDays)} hari`);
    }
  }
  await prisma.user.update({ where: { id: pesan.author.id }, data: { pesan: { increment: 1 }, lastActive: new Date(sekarang) } });

  try { await majuMisi(pesan.author.id, 'chat', 1, client); } catch (e) { logger.error(e, '[loops] majuMisi chat gagal'); }

  const jumlah = XP_CHAT[0] + Math.floor(Math.random() * (XP_CHAT[1] - XP_CHAT[0] + 1));
  await tambahXp(client, pesan.member, jumlah);
}

// ============================================================
// Pantau voice
// ============================================================

export async function pantauVoice(client: Client) {
  try {
    for (const guild of client.guilds.cache.values()) {
      for (const channel of (guild.channels.cache.filter(c => c.isVoiceBased())).values()) {
        if (guild.afkChannelId === channel.id) continue;
        const orang = channel.members.filter(m => !m.user.bot && m.voice && !m.voice.selfDeaf && !m.voice.selfMute);
        if (orang.size < 2) continue;
        for (const m of orang.values()) {
          await prisma.user.upsert({ where: { id: m.id }, create: { id: m.id, menit: 5 }, update: { menit: { increment: 5 } } });
          await tambahXp(client, m, XP_VOICE);
        }
      }
    }
  } catch (e) {
    logger.error(e, '[loops] pantau voice error');
  }
}

// ============================================================
// Rekap mingguan
// ============================================================

async function papanGame(guild: Guild, game: string, batas = 3): Promise<string[]> {
  const mingguKini = mingguIniWib();
  const semua = await prisma.arkaUser.findMany();
  const isi: [string, number][] = [];
  for (const au of semua) {
    const per: any = ((au.game as any) ?? {})[game] ?? {};
    const angka = per.mingguKunci === mingguKini ? (per.mingguMain ?? 0) : 0;
    if (angka > 0 && guild.members.cache.has(au.userId)) isi.push([au.userId, angka]);
  }
  isi.sort((a, b) => b[1] - a[1]);
  return isi.slice(0, batas).map(([uid, angka], i) => {
    const anggota = guild.members.cache.get(uid);
    const nama = anggota?.displayName ?? 'entah siapa';
    return `${['🥇', '🥈', '🥉'][i]} ${nama} — ${angka}x`;
  });
}

async function pindahinJuara(guild: Guild, juaraId: string | null) {
  if (!ROLE_JUARA) return;
  const role = guild.roles.cache.find(r => r.name === ROLE_JUARA);
  if (!role) { logger.warn(`[loops] role '${ROLE_JUARA}' ga ketemu, gelarnya dilewat`); return; }
  try {
    for (const lama of role.members.values()) {
      if (lama.id !== juaraId) await lama.roles.remove(role, 'Wave Champion minggu lalu');
    }
    const juara = juaraId ? guild.members.cache.get(juaraId) : null;
    if (juara && !juara.roles.cache.has(role.id)) await juara.roles.add(role, 'Wave Champion minggu ini');
  } catch (e: any) {
    logger.error(e, '[loops] Wave Champion bermasalah');
  }
}

export async function kirimRekap(client: Client, channel: TextChannel, resmi = false) {
  const guild = channel.guild;
  const hidup = (await prisma.user.findMany({ where: { xpMinggu: { gt: 0 } } }))
    .filter(u => guild.members.cache.has(u.id))
    .sort((a, b) => b.xpMinggu - a.xpMinggu)
    .slice(0, 3);
  if (hidup.length === 0) {
    await channel.send('Minggu ini sepi banget, ga ada yang ngumpulin XP sama sekali. Minggu depan jangan gitu ya.');
    return;
  }
  const baris = hidup.map((u, i) => `${['🥇', '🥈', '🥉'][i]}  **${guild.members.cache.get(u.id)?.displayName ?? 'entah siapa'}** — ${u.xpMinggu.toLocaleString()} XP`);
  const juaraUid = hidup[0].id;
  await prisma.user.update({ where: { id: juaraUid }, data: { juara: { increment: 1 } } });
  const kali = hidup[0].juara + 1;
  const namaJuara = guild.members.cache.get(juaraUid)?.displayName ?? 'entah siapa';
  if (resmi) await pindahinJuara(guild, juaraUid);

  const global = await getArkaGlobal();
  const daftarKategori = Object.keys(KATEGORI_GAME);
  const sorot = daftarKategori[(global.rekapGiliran ?? 0) % daftarKategori.length];
  const potongan: string[] = [];
  for (const game of KATEGORI_GAME[sorot]) {
    const barisGame = await papanGame(guild, game);
    potongan.push(`**${NAMA_GAME[game] ?? game}**\n` + (barisGame.length ? barisGame.join('\n') : 'belum ada yang main'));
  }

  const isi = new EmbedBuilder().setColor(WARNA).setTitle('🏆  Rekap Minggu Ini').setDescription(baris.join('\n'))
    .addFields(
      { name: 'Juara minggu ini', value: `**${namaJuara}**` + (kali > 1 ? ` — gelar ke-${kali}` : ''), inline: false },
      { name: `🔦 Sorotan minggu ini — ${sorot}`, value: potongan.join('\n\n'), inline: false }
    )
    .setFooter({ text: resmi && ROLE_JUARA ? `Gelar ${ROLE_JUARA} pindah ke ${namaJuara}. Hitungan mingguan direset sekarang.` : 'Hitungan mingguan direset tiap Senin. Rebutan lagi dari nol.' });
  await channel.send({ embeds: [isi] });
  await channel.send(`Papan mingguan gua kosongin. ${namaJuara} udah di depan, yang lain masa mau kalah terus.`);

  if (resmi) {
    await prisma.arkaGlobal.update({
      where: { id: 1 },
      data: { rekapTerakhir: mingguIniWib(), rekapGiliran: { increment: 1 } }
    });
    await prisma.user.updateMany({ data: { xpMinggu: 0 } });
  }
}

export async function rekapMingguan(client: Client) {
  try {
    const now = sekarangWib();
    const mingguIni = mingguIniWib();
    const waktunya = now.getDay() === HARI_REKAP && now.getHours() >= JAM_REKAP;
    const tujuan = CHANNEL_REKAP || CHANNEL_ARENA;
    const global = await getArkaGlobal();
    if (tujuan && waktunya && global.rekapTerakhir !== mingguIni) {
      const channel = channelTek(client, tujuan);
      if (channel) await kirimRekap(client, channel, true);
    }
  } catch (e) {
    logger.error(e, '[loops] rekap mingguan error');
  }
}

// ============================================================
// Pengumuman cuaca
// ============================================================

export async function umuminCuaca(client: Client) {
  try {
    const c = await cuacaHariIni();
    const jam = sekarangWib().getHours();
    const tujuan = CHANNEL_CUACA || CHANNEL_ARENA;
    if (tujuan && !c.cuacaDiumumkan && jam >= JAM_CUACA) {
      const channel = channelTek(client, tujuan);
      if (channel) {
        const isi = new EmbedBuilder()
          .setColor(WARNA)
          .setTitle(`${c.cuacaEmoji}  Cuaca hari ini: ${c.cuacaNama}`)
          .setDescription(c.cuacaKata ?? '')
          .addFields({ name: 'Pengali XP', value: `**x${c.cuacaKali}**` })
          .setFooter({ text: 'Jangan lupa /absen' });
        await prisma.arkaGlobal.update({ where: { id: 1 }, data: { cuacaDiumumkan: true } });
        try {
          await channel.send({ embeds: [isi] });
        } catch {
          await prisma.arkaGlobal.update({ where: { id: 1 }, data: { cuacaDiumumkan: false } });
          throw new Error('gagal kirim pengumuman cuaca');
        }
      }
    }
  } catch (e) {
    logger.error(e, '[loops] pengumuman cuaca error');
  }
}

// ============================================================
// Pengumuman misi & quest
// ============================================================

async function embedMisi(): Promise<EmbedBuilder> {
  const hari = await misiHariIni();
  const baris = (hari.daftar as any[]).map((m, i) => `**${i + 1}.** ${m.kalimat}  ·  +${m.xp} XP`);
  const total = (hari.daftar as any[]).reduce((a, m) => a + m.xp, 0) + MISI_BONUS;
  return new EmbedBuilder()
    .setColor(WARNA)
    .setTitle('🎯  Misi Hari Ini')
    .setDescription(baris.join('\n'))
    .addFields(
      { name: 'Kalau ketiganya kelar', value: `Bonus **${MISI_BONUS} XP**, total sehari bisa **${total.toLocaleString()} XP**`, inline: false },
      { name: 'Cara ngambilnya', value: 'Ketik `/misi` di sini. Kemajuan lo cuma keliatan sama lo sendiri, dan hadiahnya masuk pas lo ngetik itu.', inline: false }
    )
    .setFooter({ text: 'Ganti tiap jam 00.00 WIB · pakai /gantimisi kalau ada yang ga sreg dan lo punya Kerang Ajaib' });
}

export async function umuminMisi(client: Client) {
  try {
    const hari = await misiHariIni();
    const jam = sekarangWib().getHours();
    if (CHANNEL_MISI && !(hari as any).diumumkan && jam >= JAM_MISI) {
      const channel = channelTek(client, CHANNEL_MISI);
      if (channel) {
        await prisma.arkaGlobal.update({ where: { id: 1 }, data: { misi: { ...(hari as any), diumumkan: true } } as any });
        try {
          await channel.send({ embeds: [await embedMisi()] });
        } catch {
          await prisma.arkaGlobal.update({ where: { id: 1 }, data: { misi: { ...(hari as any), diumumkan: false } } as any });
          throw new Error('gagal kirim pengumuman misi');
        }
      }
    }
  } catch (e) {
    logger.error(e, '[loops] pengumuman misi error');
  }
}

async function bayarQuest(client: Client, guild: Guild, channel: TextChannel) {
  const global = await getArkaGlobal();
  const quest: any = (global as any).quest ?? {};
  const penyumbang: Record<string, number> = quest.penyumbang ?? {};
  if (Object.keys(penyumbang).length === 0) return;
  const urut = Object.entries(penyumbang).sort((a, b) => b[1] - a[1]);
  const dibayar: [string, number][] = [];
  for (const [uid] of urut) {
    const anggota = guild.members.cache.get(uid);
    if (!anggota) continue;
    if (anggota) await tambahXp(client, anggota, QUEST_BONUS);
    dibayar.push([anggota.displayName, penyumbang[uid]]);
  }
  if (dibayar.length === 0) return;
  const baris = dibayar.slice(0, 15).map(([nama, banyak]) => `**${nama}** — nyumbang ${banyak}`).join('\n');
  const isi = new EmbedBuilder()
    .setColor(WARNA)
    .setTitle('🤝  Quest server TEMBUS')
    .setDescription(`**${quest.kalimat}**\nTarget ${quest.target} kelewat bareng bareng.\n\n${baris}`)
    .setFooter({ text: `${dibayar.length} orang dapet ${QUEST_BONUS} XP masing masing. Quest baru diundi Senin.` });
  await channel.send({ embeds: [isi] });
}

export async function jagaQuest(client: Client) {
  try {
    if (!QUEST_AKTIF) return;
    let quest: any = await questSekarang();
    const tujuan = CHANNEL_QUEST || CHANNEL_ARENA;
    const channel = channelTek(client, tujuan);
    if (!channel || !quest) return;

    if (!(quest as any).diumumkan) {
      quest = { ...quest, diumumkan: true };
      await prisma.arkaGlobal.update({ where: { id: 1 }, data: { quest } } as any);
      const rasio = Math.min(1.0, quest.maju / Math.max(1, quest.target));
      const panjang = 16;
      const batangQuest = '▰'.repeat(Math.round(rasio * panjang)) + '▱'.repeat(panjang - Math.round(rasio * panjang));
      const isi = new EmbedBuilder()
        .setColor(WARNA)
        .setTitle('🤝  Quest server minggu ini')
        .setDescription(`## ${quest.kalimat}\n\`${batangQuest}\`  **${quest.maju}/${quest.target}**`)
        .addFields({ name: 'Hadiah', value: `Kalau tembus, **semua yang nyumbang** dapet **${QUEST_BONUS} XP**. Nyumbang satu pun tetep kebagian.`, inline: false });
      await channel.send({ content: 'Quest baru minggu ini. Ini ga bisa dikelarin sendirian.', embeds: [isi] });
    }
    if (quest.kelar && !quest.dibayar) {
      quest = { ...quest, dibayar: true };
      await prisma.arkaGlobal.update({ where: { id: 1 }, data: { quest } } as any);
      await bayarQuest(client, channel.guild, channel);
    }
  } catch (e) {
    logger.error(e, '[loops] quest error');
  }
}

// ============================================================
// Pengumuman toko & wishlist
// ============================================================

async function kabarinWishlist(guild: Guild, stok: string[]) {
  if (!WISHLIST_AKTIF) return 0;
  let dikabarin = 0;
  const semua = await prisma.arkaUser.findMany();
  for (const au of semua) {
    const incaran: string[] = (au.wishlist as any) ?? [];
    const kena = incaran.filter(k => stok.includes(k));
    if (kena.length === 0) continue;
    const anggota = guild.members.cache.get(au.userId);
    if (!anggota) continue;
    const userData = await prisma.user.findUnique({ where: { id: au.userId } });
    const baris: string[] = [];
    for (const kode of kena) {
      const info = cariBarang(kode);
      if (!info) continue;
      const harga = info[3];
      const cukup = (userData?.xp ?? 0) >= harga ? '✅ XP lo cukup' : `⚠️ kurang ${(harga - (userData?.xp ?? 0)).toLocaleString()} XP`;
      baris.push(`${info[1]} **${info[2]}** — ${harga.toLocaleString()} XP  ·  ${cukup}`);
    }
    try {
      await anggota.send(`⭐ **Barang incaran lo masuk stok minggu ini.**\n\n${baris.join('\n')}\n\nStok ganti lagi Senin depan. Beli pakai \`/beli\`.`);
      dikabarin += 1;
    } catch { /* Forbidden */ }
  }
  return dikabarin;
}

export async function umuminToko(client: Client) {
  try {
    const stok = await stokToko();
    const global = await getArkaGlobal();
    const toko: any = (global as any).toko ?? {};
    const jam = sekarangWib().getHours();
    if (CHANNEL_TOKO && !toko.diumumkan && jam >= JAM_TOKO) {
      const channel = channelTek(client, CHANNEL_TOKO);
      if (channel) {
        await channel.send({ content: '🛒 **Stok toko minggu ini udah ganti.**', embeds: [await embedToko()] });
        await prisma.arkaGlobal.update({ where: { id: 1 }, data: { toko: { ...toko, diumumkan: true } } } as any);
        await kabarinWishlist(channel.guild, stok);
      }
    }
  } catch (e) {
    logger.error(e, '[loops] pengumuman toko error');
  }
}

// ============================================================
// Julukan kadaluarsa
// ============================================================

export async function jagaJulukan(client: Client) {
  try {
    const sekarang = new Date();
    const semua = await prisma.arkaUser.findMany();
    for (const au of semua) {
      const efek: any = (au.efek as any) ?? {};
      if (!efek.julukan_sampai) continue;
      const sampai = new Date(efek.julukan_sampai);
      if (isNaN(sampai.getTime()) || sampai > sekarang) continue;
      const roleId = efek.julukan_role;
      delete efek.julukan_role;
      delete efek.julukan_sampai;
      await prisma.arkaUser.update({ where: { userId: au.userId }, data: { efek } as any });
      if (!roleId) continue;
      for (const guild of client.guilds.cache.values()) {
        const role = guild.roles.cache.get(roleId);
        if (role) {
          await role.delete('Masa julukan habis').catch(() => {});
          break;
        }
      }
    }
  } catch (e) {
    logger.error(e, '[loops] jaga julukan error');
  }
}

// ============================================================
// Season
// ============================================================

async function tutupSeason(client: Client, channel: TextChannel) {
  const global = await getArkaGlobal();
  const musim: any = (global as any).seasonData ?? { nomor: global.season ?? 1, mulai: hariIniWib(), hall: [] };
  musim.hall = musim.hall ?? [];
  const guild = channel.guild;
  const hidup = (await prisma.user.findMany({ where: { xp: { gt: 0 } } }))
    .filter(u => guild.members.cache.has(u.id))
    .sort((a, b) => b.xp - a.xp);
  const atas = hidup.slice(0, SEASON_JUARA_DISIMPAN);
  const papan = atas.map((u, i) => ({
    peringkat: i + 1,
    id: u.id,
    nama: guild.members.cache.get(u.id)?.displayName ?? 'entah siapa',
    xp: u.xp,
    tingkat: tingkat(u.xp)[1]
  }));
  musim.hall.push({ musim: musim.nomor, mulai: musim.mulai, selesai: hariIniWib(), juara: papan });

  // Pangkas XP semua orang
  const semuaUser = await prisma.user.findMany({ where: { xp: { gt: 0 } } });
  for (const u of semuaUser) {
    const au = await prisma.arkaUser.upsert({ where: { userId: u.id }, create: { userId: u.id }, update: {} });
    await prisma.$transaction([
      prisma.arkaUser.update({ where: { userId: u.id }, data: { xpAbadi: au.xpAbadi + u.xp } }),
      prisma.user.update({ where: { id: u.id }, data: { xp: Math.floor(u.xp * SEASON_SISA_PERSEN), xpMinggu: 0 } })
    ]);
  }
  const nomorLama = musim.nomor;
  musim.nomor += 1;
  musim.mulai = hariIniWib();

  // Rapikan role tingkatan
  const semuaRole = new Set(TINGKAT.map(t => String(t[2])).filter(Boolean));
  let dirapiin = 0;
  for (const u of semuaUser) {
    const anggota = guild.members.cache.get(u.id);
    if (!anggota) continue;
    const benar = tingkat(Math.floor(u.xp * SEASON_SISA_PERSEN))[2];
    const salah = anggota.roles.cache.filter(r => semuaRole.has(r.name) && r.name !== String(benar ?? ''));
    if (salah.size === 0) continue;
    try {
      await anggota.roles.remove(salah, 'Musim baru');
      dirapiin += 1;
    } catch { /* Forbidden */ }
  }

  await prisma.$transaction([
    prisma.arkaGlobal.update({ where: { id: 1 }, data: { seasonData: musim, season: musim.nomor } } as any),
  ]);

  const tanda = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'];
  const baris = papan.map(j => `${tanda[j.peringkat - 1]} **${j.nama}** — ${j.xp.toLocaleString()} XP · ${j.tingkat}`).join('\n') || '_ga ada yang nyemplung musim ini_';
  const isi = new EmbedBuilder()
    .setColor(WARNA)
    .setTitle(`🌅  Musim ${nomorLama} selesai`)
    .setDescription(`Papan ditutup. Ini yang paling dalam musim kemarin:\n\n${baris}`)
    .addFields({
      name: `Musim ${musim.nomor} dimulai`,
      value: `XP semua orang dipangkas jadi **${Math.floor(SEASON_SISA_PERSEN * 100)}%**. Total XP sepanjang masa lo tetep kesimpen dan bisa diliat di \`/profil\`.\nPapan sekarang rata lagi. Yang baru gabung punya kesempatan.`,
      inline: false
    });
  if (dirapiin > 0) isi.setFooter({ text: `Role tingkatan ${dirapiin} orang dirapiin` });
  await channel.send({ embeds: [isi] });
}

export async function jagaSeason(client: Client) {
  try {
    if (!SEASON_AKTIF) return;
    const global = await getArkaGlobal();
    const musim: any = (global as any).seasonData ?? { nomor: global.season ?? 1, mulai: hariIniWib(), hall: [] };
    if (!musim.mulai) return;
    const akhir = new Date(new Date(musim.mulai).getTime() + SEASON_BULAN * 30 * 86400000);
    if (sekarangWib() >= akhir) {
      const tujuan = CHANNEL_REKAP || CHANNEL_ARENA;
      const channel = channelTek(client, tujuan);
      if (channel) await tutupSeason(client, channel);
    }
  } catch (e) {
    logger.error(e, '[loops] season error');
  }
}

// ============================================================
// Kapsul waktu
// ============================================================

async function bukaKapsul(client: Client, daftar: any[]) {
  const tujuan = CHANNEL_REKAP || CHANNEL_ARENA;
  const channel = channelTek(client, tujuan);
  if (!channel) return;
  await channel.send(`⛵ **Kapal Waktu sandar.** Ada **${daftar.length} pesan** yang dititipin buat hari ini. Yang nulis mungkin udah lupa.`);
  for (const k of daftar) {
    const anggota = channel.guild.members.cache.get(k.orang);
    const nama = anggota?.displayName ?? 'entah siapa';
    let jarak: number | string = '?';
    try {
      jarak = Math.round((new Date(k.buka).getTime() - new Date(k.ditulis).getTime()) / 86400000);
    } catch { /* biarkan '?' */ }
    const isi = new EmbedBuilder()
      .setColor(WARNA)
      .setTitle(`Dari ${nama}, ${jarak} hari yang lalu`)
      .setDescription(k.isi)
      .setFooter({ text: `Ditulis ${k.ditulis}` });
    if (anggota) isi.setThumbnail(anggota.displayAvatarURL());
    await channel.send({ embeds: [isi] });
    await new Promise(r => setTimeout(r, 2000));
  }
}

export async function jagaKapsul(client: Client) {
  try {
    if (!KAPSUL_AKTIF) return;
    const now = sekarangWib();
    const hari = hariIniWib();
    const global = await getArkaGlobal();
    if (now.getHours() >= KAPSUL_JAM_BUKA && global.kapsulTerakhir !== hari) {
      const semua: any[] = (global as any).kapsul ?? [];
      const jatuh = semua.filter(k => !k.dibuka && k.buka <= hari);
      for (const k of jatuh) k.dibuka = true;
      await prisma.arkaGlobal.update({ where: { id: 1 }, data: { kapsul: semua, kapsulTerakhir: hari } } as any);
      if (jatuh.length > 0) await bukaKapsul(client, jatuh);
    }
  } catch (e) {
    logger.error(e, '[loops] kapsul error');
  }
}

// ============================================================
// Mulai semua loop
// ============================================================

export function mulaiSemuaLoop(client: Client) {
  setInterval(() => void umuminCuaca(client), 10 * 60_000);
  setInterval(() => void umuminMisi(client), 10 * 60_000);
  setInterval(() => void jagaQuest(client), 10 * 60_000);
  setInterval(() => void umuminToko(client), 10 * 60_000);
  setInterval(() => void jagaJulukan(client), 60 * 60_000);
  setInterval(() => void jagaSeason(client), 60 * 60_000);
  setInterval(() => void jagaKapsul(client), 30 * 60_000);
  setInterval(() => void rekapMingguan(client), 15 * 60_000);
  setInterval(() => void pantauVoice(client), JEDA_VOICE_MS);
  setInterval(() => void bersihkanJedaTerakhir(), 5 * 60_000);
  logger.info('[arka] Semua loop ekonomi & sosial jalan');
}
