import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, Client } from 'discord.js';
import prisma from '../prisma';
import {
  WARNA, MISI_PILIHAN, MISI_JUMLAH, MISI_BONUS, MISI_MINGGU_HARI, MISI_MINGGU_XP, MISI_DM,
  QUEST_AKTIF, QUEST_PILIHAN, QUEST_BONUS
} from '../config';
import { getArkaGlobal } from '../core';
import { beriXp } from '../gameCore';

function hariIni() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' }); // YYYY-MM-DD in WIB
}

function mingguIni() {
  const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }));
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const yearStart = new Date(d.getFullYear(), 0, 1);
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${d.getFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

async function getArkaUser(userId: string) {
  await prisma.user.upsert({ where: { id: userId }, create: { id: userId }, update: {} });
  return prisma.arkaUser.upsert({ where: { userId }, create: { userId }, update: {} });
}

export async function misiHariIni() {
  const global = await getArkaGlobal();
  const kunci = hariIni();
  let misiData: any = (global as any).misi ?? {};
  if (misiData.tanggal !== kunci) {
    let kemarinDaftar = [];
    if (misiData.daftar) kemarinDaftar = misiData.daftar;
    const pilihan = [...MISI_PILIHAN].sort(() => Math.random() - 0.5).slice(0, MISI_JUMLAH);
    const daftar = pilihan.map(([k, t, n, x]) => ({ kode: k, kalimat: (t as string).replace('{n}', String(n)), target: n, xp: x }));
    misiData = { tanggal: kunci, daftar, diumumkan: false };
    await prisma.arkaGlobal.update({ where: { id: 1 }, data: { misi: misiData, misiKemarinDaftar: kemarinDaftar } as any });
  }
  return misiData;
}

export async function questSekarang() {
  if (!QUEST_AKTIF) return null;
  const global = await getArkaGlobal();
  const kunci = mingguIni();
  let questData: any = (global as any).quest ?? {};
  if (questData.minggu !== kunci) {
    const pilihan = QUEST_PILIHAN[Math.floor(Math.random() * QUEST_PILIHAN.length)];
    const [kode, kalimat, target] = pilihan;
    questData = { 
      minggu: kunci, 
      kode, 
      kalimat: (kalimat as string).replace('{n}', String(target)), 
      target, 
      maju: 0, 
      penyumbang: {}, 
      kelar: false, 
      diumumkan: false 
    };
    await prisma.arkaGlobal.update({ where: { id: 1 }, data: { quest: questData } as any });
  }
  return questData;
}

export async function majuQuest(userId: string, kode: string, jumlah = 1) {
  if (!QUEST_AKTIF) return false;
  const questData = await questSekarang();
  if (!questData || questData.kelar || questData.kode !== kode) return false;
  questData.maju += jumlah;
  questData.penyumbang[userId] = (questData.penyumbang[userId] ?? 0) + jumlah;
  if (questData.maju >= questData.target) questData.kelar = true;
  await prisma.arkaGlobal.update({ where: { id: 1 }, data: { quest: questData } as any });
  return questData.kelar;
}

export async function misiOrang(userId: string) {
  const hari = await misiHariIni();
  const arkaUser = await getArkaUser(userId);
  const misi: any = (arkaUser as any).misi ?? {};
  
  if (misi.tanggal !== hari.tanggal) {
    if (misi.tanggal) {
      let belum = 0;
      const global = await getArkaGlobal();
      const kemarinDaftar: any[] = (global as any).misiKemarinDaftar ?? [];
      const diambil = misi.diambil ?? [];
      for (const m of kemarinDaftar) {
        if (!diambil.includes(m.kode)) belum += Math.floor(m.xp / 2);
      }
      if (belum > 0) await prisma.arkaUser.update({ where: { userId }, data: { misiKemarin: belum } as any });
    }
    misi.tanggal = hari.tanggal;
    misi.maju = {};
    misi.diambil = [];
    misi.dikabarin = [];
    misi.ganti = {};
  }
  
  misi.maju = misi.maju ?? {};
  misi.diambil = misi.diambil ?? [];
  misi.dikabarin = misi.dikabarin ?? [];
  misi.ganti = misi.ganti ?? {};
  
  const daftar = hari.daftar.map((m: any, i: number) => misi.ganti[String(i)] ?? m);
  return { daftar, misi, arkaUser };
}

export async function majuMisi(userId: string, kode: string, jumlah = 1, client?: Client) {
  await majuQuest(userId, kode, jumlah);
  const { daftar, misi } = await misiOrang(userId);
  const ikut = daftar.filter((m: any) => m.kode === kode);
  if (ikut.length === 0) return;

  const sebelum = misi.maju[kode] ?? 0;
  misi.maju[kode] = sebelum + jumlah;

  // DM notifikasi pas misi baru aja kelar (port kabarin_misi)
  if (client && MISI_DM) {
    for (const m of ikut) {
      const baruKelar = sebelum < m.target && misi.maju[kode] >= m.target;
      if (baruKelar && !misi.dikabarin.includes(m.kode)) {
        misi.dikabarin.push(m.kode);
        try {
          const orang = await client.users.fetch(userId);
          const isi = new EmbedBuilder()
            .setColor(WARNA)
            .setTitle('✅  Satu misi kelar')
            .setDescription(`**${m.kalimat}**\n+${m.xp} XP nunggu diambil.`)
            .setFooter({ text: 'Ketik /misi di channel bot buat ngambilnya' });
          await orang.send({ embeds: [isi] });
        } catch { /* DM keblokir — biarin */ }
      }
    }
  }

  await prisma.arkaUser.update({ where: { userId }, data: { misi } as any });
}

export const misiCommand = {
  data: new SlashCommandBuilder().setName('misi').setDescription('Misi hari ini, sekalian ambil hadiahnya'),
  async executeSlash(inter: ChatInputCommandInteraction) {
    let { daftar, misi, arkaUser } = await misiOrang(inter.user.id);
    let bayarLumba = 0;
    let lumbaKepakai = false;
    const sisaKemarin = (arkaUser as any).misiKemarin ?? 0;
    const barang: any = (arkaUser as any).barang ?? {};
    
    if (sisaKemarin > 0 && (barang.lumba ?? 0) > 0) {
      barang.lumba -= 1;
      if (barang.lumba === 0) delete barang.lumba;
      bayarLumba = sisaKemarin;
      lumbaKepakai = true;
    }
    
    let totalXp = 0;
    const baris = [];
    const baruKelar = [];
    
    for (const m of daftar) {
      const punya = misi.maju[m.kode] ?? 0;
      const kelar = punya >= m.target;
      if (kelar && !misi.diambil.includes(m.kode)) {
        misi.diambil.push(m.kode);
        baruKelar.push(m);
        totalXp += m.xp;
      }
      const tanda = kelar ? '✅' : '⬜';
      baris.push(`${tanda}  ${m.kalimat}  ·  \`${Math.min(punya, m.target)}/${m.target}\`  ·  +${m.xp} XP`);
    }
    
    const semuaKelar = daftar.every((m: any) => (misi.maju[m.kode] ?? 0) >= m.target);
    let bonus = 0;
    if (semuaKelar && !misi.diambil.includes('BONUS')) {
      misi.diambil.push('BONUS');
      bonus = MISI_BONUS;
      totalXp += bonus;
    }
    
    totalXp += bayarLumba;
    if (totalXp > 0) {
      await beriXp(inter.client, inter.guild, inter.user.id, totalXp);
    }
    
    let minggu: any = (arkaUser as any).misiMinggu ?? {};
    const kunciMinggu = mingguIni();
    if (minggu.minggu !== kunciMinggu) {
      minggu = { minggu: kunciMinggu, hari: [], diambil: false };
    }
    if (semuaKelar && !minggu.hari.includes(hariIni())) {
      minggu.hari.push(hariIni());
    }
    
    const kelarMinggu = minggu.hari.length;
    let hadiahMinggu = 0;
    if (kelarMinggu >= MISI_MINGGU_HARI && !minggu.diambil) {
      minggu.diambil = true;
      hadiahMinggu = MISI_MINGGU_XP;
      await beriXp(inter.client, inter.guild, inter.user.id, hadiahMinggu);
    }
    
    await prisma.arkaUser.update({ 
      where: { userId: inter.user.id }, 
      data: { misi, barang, misiMinggu: minggu, misiKemarin: null } as any 
    });
    
    const embed = new EmbedBuilder().setColor(WARNA).setTitle('🏝️  Misi Hari Ini').setDescription(baris.join('\n'));
    const catatanBawah = [];
    if (baruKelar.length > 0) catatanBawah.push(`Baru kelar: ${baruKelar.map(m => m.kalimat).join(', ')}`);
    if (bonus > 0) catatanBawah.push(`🎁 **Ketiganya kelar!** Bonus ${bonus} XP.`);
    if (lumbaKepakai) catatanBawah.push(`🐬 **Sahabat Lumba lumba kepakai.** Misi kemarin yang ga kelar dibayar setengah: +${bayarLumba} XP.`);
    
    if (catatanBawah.length > 0) embed.addFields({ name: `Masuk +${totalXp.toLocaleString()} XP`, value: catatanBawah.join('\n'), inline: false });
    else if (semuaKelar) embed.addFields({ name: 'Udah kelar semua', value: 'Hadiahnya udah lo ambil. Besok ganti misi baru.', inline: false });
    
    const bar = '▰'.repeat(Math.min(kelarMinggu, MISI_MINGGU_HARI)) + '▱'.repeat(Math.max(0, MISI_MINGGU_HARI - kelarMinggu));
    let nilai = '';
    if (hadiahMinggu > 0) nilai = `\`${bar}\` **KELAR!**\n🏆 Misi mingguan tuntas, +${hadiahMinggu.toLocaleString()} XP.`;
    else if (minggu.diambil) nilai = `\`${bar}\` udah diambil minggu ini. Reset Senin.`;
    else nilai = `\`${bar}\` ${kelarMinggu} dari ${MISI_MINGGU_HARI} hari\nKelarin misi harian ${MISI_MINGGU_HARI} hari dalam seminggu buat dapet ${MISI_MINGGU_XP.toLocaleString()} XP.`;
    embed.addFields({ name: '🗓️ Misi Mingguan', value: nilai, inline: false });
    
    const punyaKerang = barang.kerang ?? 0;
    embed.setFooter({ text: `Cuma lo yang liat pesan ini. ${punyaKerang ? `Punya ${punyaKerang} Kerang Ajaib, pakai /gantimisi kalau ada misi yang ga sreg.` : 'Misi ganti tiap jam 00.00 WIB.'}` });
    
    await inter.reply({ embeds: [embed], ephemeral: true });
  }
};

export const gantiMisiCommand = {
  data: new SlashCommandBuilder()
    .setName('gantimisi')
    .setDescription('Tukar satu misi pakai Kerang Ajaib')
    .addIntegerOption(o => o.setName('nomor').setDescription('Misi ke berapa yang mau diganti (1-3)').setRequired(true).setMinValue(1).setMaxValue(3)),
  async executeSlash(inter: ChatInputCommandInteraction) {
    const nomor = inter.options.getInteger('nomor', true);
    const { daftar, misi, arkaUser } = await misiOrang(inter.user.id);
    if (nomor > daftar.length) { await inter.reply({ content: `Nomornya 1 sampai ${daftar.length} aja.`, ephemeral: true }); return; }
    const barang: any = (arkaUser as any).barang ?? {};
    if ((barang.kerang ?? 0) < 1) { await inter.reply({ content: 'Lo ga punya Kerang Ajaib. Beli dulu di `/toko`.', ephemeral: true }); return; }
    
    const lamaMisi = daftar[nomor - 1];
    if ((misi.maju[lamaMisi.kode] ?? 0) >= lamaMisi.target) { await inter.reply({ content: 'Misi itu udah kelar, ngapain diganti.', ephemeral: true }); return; }
    
    const kepakai = daftar.map((m: any) => m.kode);
    const sisa = MISI_PILIHAN.filter(x => !kepakai.includes(x[0]));
    if (sisa.length === 0) { await inter.reply({ content: 'Ga ada misi lain yang bisa dituker.', ephemeral: true }); return; }
    
    const [kode, kalimat, target, xp] = sisa[Math.floor(Math.random() * sisa.length)];
    misi.ganti[String(nomor - 1)] = { kode, kalimat: (kalimat as string).replace('{n}', String(target)), target, xp };
    
    barang.kerang -= 1;
    if (barang.kerang === 0) delete barang.kerang;
    await prisma.arkaUser.update({ where: { userId: inter.user.id }, data: { misi, barang } as any });
    
    await inter.reply({ content: `🐚 Kerang Ajaib kepakai.\n~~${lamaMisi.kalimat}~~\n→ **${(kalimat as string).replace('{n}', String(target))}**  ·  +${xp} XP`, ephemeral: true });
  }
};

export const questCommand = {
  data: new SlashCommandBuilder().setName('quest').setDescription('Quest bareng satu server minggu ini'),
  async executeSlash(inter: ChatInputCommandInteraction) {
    const quest = await questSekarang();
    if (!quest) { await inter.reply({ content: 'Quest komunal lagi dimatiin.', ephemeral: true }); return; }
    
    const rasio = Math.min(1.0, quest.maju / Math.max(1, quest.target));
    const panjang = 16;
    const isiBatang = Math.round(rasio * panjang);
    const batangQuest = '▰'.repeat(isiBatang) + '▱'.repeat(panjang - isiBatang);
    
    const embed = new EmbedBuilder()
      .setColor(WARNA)
      .setTitle('🤝  Quest server minggu ini')
      .setDescription(`## ${quest.kalimat}\n\`${batangQuest}\`  **${quest.maju}/${quest.target}**`);
      
    if (quest.kelar) {
      embed.addFields({ name: 'Status', value: '✅ Udah tembus. Hadiah kebagi.', inline: false });
    } else {
      embed.addFields({ name: 'Hadiah', value: `Kalau tembus, **semua yang nyumbang** dapet **${QUEST_BONUS} XP**. Nyumbang satu pun tetep kebagian.`, inline: false });
    }
    
    const penyumbangCount = Object.keys(quest.penyumbang ?? {}).length;
    if (penyumbangCount > 0) embed.addFields({ name: 'Yang udah ikut', value: `${penyumbangCount} orang`, inline: true });
    
    const punya = (quest.penyumbang ?? {})[inter.user.id] ?? 0;
    embed.setFooter({ text: punya ? `Sumbangan lo: ${punya}` : 'Lo belum nyumbang apa apa minggu ini' });
    
    await inter.reply({ embeds: [embed] });
  }
};
