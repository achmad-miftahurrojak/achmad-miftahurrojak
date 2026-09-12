import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, GuildMember, PermissionFlagsBits } from 'discord.js';
import prisma from '../prisma';
import {
  WARNA, LENCANA, BARANG, TANGKAPAN,
  PET_AKTIF, PET_NAMA, PET_LAPAR_PER_JAM, PET_HARGA_MAKAN, PET_ISI_MAKAN, PET_MAKAN_MAKS_HARIAN,
  KAPSUL_AKTIF, KAPSUL_HARI_MIN, KAPSUL_HARI_MAKS, KAPSUL_MAKS_PER_ORANG,
  KASIH_AKTIF, KASIH_MIN, KASIH_MAKS_HARIAN, KASIH_POTONGAN,
  RANTAI_XP, RANTAI_XP_REKOR,
  SEASON_BULAN
} from '../config';
import { tambahXp, tingkat, berikutnya, getArkaGlobal, kondisiPet, suasanaPet } from '../core';

function hariIni() {
  return new Date().toISOString().split('T')[0];
}

async function getArkaUser(userId: string) {
  await prisma.user.upsert({ where: { id: userId }, create: { id: userId }, update: {} });
  return prisma.arkaUser.upsert({ where: { userId }, create: { userId }, update: {} });
}

function batang(isi: number, total: number, panjang = 10) {
  const n = Math.round((isi / Math.max(total, 1)) * panjang);
  return '▰'.repeat(Math.max(0, n)) + '▱'.repeat(Math.max(0, panjang - n));
}

function lencana_punya(user: any, arkaUser: any) {
  const hasil: { kode: string; emoji: string; nama: string; kalimat: string }[] = [];
  for (const [kode, emoji, nama, kalimat, kunci, target] of LENCANA) {
    const field = user[kunci as string] ?? 0;
    if (field >= (target as number)) hasil.push({ kode: kode as string, emoji: emoji as string, nama: nama as string, kalimat: kalimat as string });
  }
  const koleksi: Record<string, number> = (arkaUser.koleksi as any) ?? {};
  if (Object.keys(koleksi).length >= TANGKAPAN.length) {
    hasil.push({ kode: 'kolektor', emoji: '🐚', nama: 'Kolektor Pantai', kalimat: 'Nemu semua jenis tangkapan' });
  }
  const kasihKe: string[] = (arkaUser.kasihKe as any) ?? [];
  if (kasihKe.length >= 5) {
    hasil.push({ kode: 'dermawan', emoji: '🤝', nama: 'Dermawan', kalimat: 'Kasih XP ke 5 orang berbeda' });
  }
  return hasil;
}

function lencana_berikutnya(user: any) {
  let dekat: { rasio: number; emoji: string; nama: string; punya: number; target: number; kalimat: string } | null = null;
  for (const [, emoji, nama, kalimat, kunci, target] of LENCANA) {
    const punya: number = user[kunci as string] ?? 0;
    const t = target as number;
    if (punya >= t) continue;
    const rasio = punya / t;
    if (!dekat || rasio > dekat.rasio) {
      dekat = { rasio, emoji: emoji as string, nama: nama as string, punya, target: t, kalimat: kalimat as string };
    }
  }
  return dekat;
}

// /profil
export const profilCommand = {
  data: new SlashCommandBuilder()
    .setName('profil')
    .setDescription('Semua data lo dalam satu tampilan')
    .addUserOption(o => o.setName('orang').setDescription('Kosongin kalau mau liat punya sendiri')),
  async executeSlash(inter: ChatInputCommandInteraction) {
    const target = (inter.options.getMember('orang') as GuildMember | null) ?? (inter.member as GuildMember);
    const user = await prisma.user.findUnique({ where: { id: target.id } });
    if (!user) { await inter.reply({ content: 'Data belum ada. Ngobrol dulu biar nyambung!', ephemeral: true }); return; }
    const arkaUser = await getArkaUser(target.id);
    const xp = user.xp;
    const depan = berikutnya(xp);
    const embed = new EmbedBuilder()
      .setColor(WARNA)
      .setTitle(`🌊  ${target.displayName} — ${tingkat(xp)[1]}`)
      .setDescription(`**${xp.toLocaleString()} XP** sepanjang masa · **${user.xpMinggu.toLocaleString()} XP** minggu ini`)
      .setThumbnail(target.displayAvatarURL());
    if (depan) {
      embed.addFields({ name: `Menuju ${depan[1]}`, value: `\`${batang(xp, depan[0] as number)}\`  kurang ${((depan[0] as number) - xp).toLocaleString()} XP`, inline: false });
    }
    embed.addFields(
      { name: 'Aktivitas', value: `${user.pesan.toLocaleString()} pesan\n${user.menit.toLocaleString()} menit voice`, inline: true },
      { name: 'Absen', value: `${user.absen} hari beruntun\nrekor ${user.absenPanjang} hari`, inline: true },
      { name: 'Tanding', value: `${user.menang} menang\n${user.kalah} kalah`, inline: true }
    );
    const barang: Record<string, number> = (arkaUser.barang as any) ?? {};
    const rincian = Object.entries(barang).map(([kode, banyak]) => {
      const b = BARANG.find(x => x[0] === kode);
      return b ? `${b[1]} ${b[2]} ×${banyak}` : null;
    }).filter(Boolean);
    if (rincian.length > 0) embed.addFields({ name: 'Tas', value: rincian.join('\n'), inline: true });
    const koleksi: Record<string, number> = (arkaUser.koleksi as any) ?? {};
    if (Object.keys(koleksi).length > 0) {
      const lengkap = Object.keys(koleksi).length >= TANGKAPAN.length;
      embed.addFields({ name: 'Koleksi', value: `${Object.keys(koleksi).length}/${TANGKAPAN.length} jenis${lengkap ? '  ✨ lengkap' : ''}`, inline: true });
    }
    if (user.juara > 0) embed.addFields({ name: 'Gelar juara', value: `🏆 ${user.juara}x`, inline: true });
    const lencana = lencana_punya(user, arkaUser);
    if (lencana.length > 0) embed.addFields({ name: `Lencana (${lencana.length})`, value: lencana.map(l => `${l.emoji} ${l.nama}`).join('  '), inline: false });
    const dekat = lencana_berikutnya(user);
    if (dekat) embed.addFields({ name: 'Lencana terdekat', value: `${dekat.emoji} **${dekat.nama}** — ${dekat.kalimat}  (${dekat.punya}/${dekat.target})`, inline: false });
    embed.setFooter({ text: 'Semua data lo dalam satu tempat.' });
    await inter.reply({ embeds: [embed] });
  }
};

// /absenbulan
export const absenBulanCommand = {
  data: new SlashCommandBuilder().setName('absenbulan').setDescription('Rekap absen lo bulan ini'),
  async executeSlash(inter: ChatInputCommandInteraction) {
    const user = await prisma.user.findUnique({ where: { id: inter.user.id } });
    if (!user) { await inter.reply({ content: 'Belum ada data. Absen dulu!', ephemeral: true }); return; }
    const arkaUser = await getArkaUser(inter.user.id);
    const riwayat: string[] = (arkaUser as any).absenRiwayat ?? [];
    const sekarang = new Date();
    const bulanIni = sekarang.toISOString().slice(0, 7);
    const bulanLaluDate = new Date(sekarang.getFullYear(), sekarang.getMonth() - 1, 1);
    const bulanLalu = bulanLaluDate.toISOString().slice(0, 7);
    const ini = riwayat.filter(t => t.startsWith(bulanIni));
    const lalu = riwayat.filter(t => t.startsWith(bulanLalu));
    const lewat = sekarang.getDate();
    const persen = ini.length / lewat * 100;
    const embed = new EmbedBuilder()
      .setColor(WARNA)
      .setTitle(`📅  Absen ${sekarang.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}`)
      .setDescription(`**${ini.length} dari ${lewat} hari** (${persen.toFixed(0)}%)`)
      .setThumbnail(inter.user.displayAvatarURL());
    const tanda = [];
    for (let h = 1; h <= lewat; h++) {
      const tgl = new Date(sekarang.getFullYear(), sekarang.getMonth(), h).toISOString().split('T')[0];
      tanda.push(ini.includes(tgl) ? '🟦' : '⬜');
    }
    embed.addFields({ name: 'Sebulan ini', value: tanda.join(''), inline: false });
    if (lalu.length > 0) {
      const selisih = ini.length - lalu.length;
      const arah = selisih > 0 ? 'lebih rajin' : selisih < 0 ? 'lebih males' : 'sama aja';
      embed.addFields({ name: 'Bulan lalu', value: `${lalu.length} hari — bulan ini ${arah} (${selisih >= 0 ? '+' : ''}${selisih} hari)`, inline: true });
    }
    embed.addFields({ name: 'Runtutan sekarang', value: `${user.absen} hari\nrekor ${user.absenPanjang}`, inline: true });
    await inter.reply({ embeds: [embed] });
  }
};

// /kasih
export const kasihCommand = {
  data: new SlashCommandBuilder()
    .setName('kasih')
    .setDescription('Kasih sebagian XP lo ke orang lain')
    .addUserOption(o => o.setName('orang').setDescription('Mau dikasih ke siapa').setRequired(true))
    .addIntegerOption(o => o.setName('jumlah').setDescription('Berapa XP').setRequired(true).setMinValue(1)),
  async executeSlash(inter: ChatInputCommandInteraction) {
    if (!KASIH_AKTIF) { await inter.reply({ content: 'Fitur ini lagi dimatiin.', ephemeral: true }); return; }
    const target = inter.options.getMember('orang') as GuildMember;
    const jumlah = inter.options.getInteger('jumlah', true);
    if (target.user.bot) { await inter.reply({ content: 'Bot ga butuh XP.', ephemeral: true }); return; }
    if (target.id === inter.user.id) { await inter.reply({ content: 'Ga bisa kasih ke diri sendiri.', ephemeral: true }); return; }
    if (jumlah < KASIH_MIN) { await inter.reply({ content: `Minimal **${KASIH_MIN} XP** sekali kasih.`, ephemeral: true }); return; }
    const pengirim = await prisma.user.findUnique({ where: { id: inter.user.id } });
    if (!pengirim) { await inter.reply({ content: 'Data lo belum ada.', ephemeral: true }); return; }
    if (pengirim.xp < jumlah) { await inter.reply({ content: `XP lo cuma **${pengirim.xp.toLocaleString()}**.`, ephemeral: true }); return; }
    const arkaUser = await getArkaUser(inter.user.id);
    const hari = hariIni();
    const kasihHarian: any = (arkaUser.kasihHarian as any) ?? { hari: '', jumlah: 0 };
    if (kasihHarian.hari !== hari) { kasihHarian.hari = hari; kasihHarian.jumlah = 0; }
    const sisaJatah = KASIH_MAKS_HARIAN - kasihHarian.jumlah;
    if (jumlah > sisaJatah) { await inter.reply({ content: `Sisa jatah lo hari ini **${sisaJatah.toLocaleString()} XP**.`, ephemeral: true }); return; }
    const nyampe = Math.max(1, Math.floor(jumlah * (1 - KASIH_POTONGAN)));
    const nguap = jumlah - nyampe;
    kasihHarian.jumlah += jumlah;
    const kasihKe: string[] = (arkaUser.kasihKe as any) ?? [];
    if (!kasihKe.includes(target.id)) kasihKe.push(target.id);
    await prisma.$transaction([
      prisma.user.update({ where: { id: inter.user.id }, data: { xp: { decrement: jumlah } } }),
      prisma.user.upsert({
        where: { id: target.id },
        create: { id: target.id, xp: nyampe, xpMinggu: nyampe },
        update: { xp: { increment: nyampe }, xpMinggu: { increment: nyampe } }
      }),
      prisma.arkaUser.update({ where: { userId: inter.user.id }, data: { kasihHarian: kasihHarian, kasihKe: kasihKe } })
    ]);
    await inter.reply(`🤝 ${inter.user.toString()} ngasih **${nyampe.toLocaleString()} XP** ke ${target.toString()}.\nKepotong ${nguap} XP di jalan. Sisa jatah hari ini: **${(KASIH_MAKS_HARIAN - kasihHarian.jumlah).toLocaleString()} XP**.`);
    target.send(`${inter.user.displayName} baru ngasih lo **${nyampe.toLocaleString()} XP** di ${inter.guild?.name}. Lumayan.`).catch(() => {});
  }
};

// /pet
export const petCommand = {
  data: new SlashCommandBuilder().setName('pet').setDescription(`Liat kabar ${PET_NAMA}, peliharaan server`),
  async executeSlash(inter: ChatInputCommandInteraction) {
    if (!PET_AKTIF) { await inter.reply({ content: 'Fitur peliharaan lagi dimatiin.', ephemeral: true }); return; }
    const pet = await kondisiPet();
    const { nama: namaSuasana, emoji, kali } = suasanaPet(pet.petKenyang);
    const panjang = 14;
    const n = Math.max(0, Math.min(panjang, Math.round(pet.petKenyang / 100 * panjang)));
    const bar = '▰'.repeat(n) + '▱'.repeat(panjang - n);
    const embed = new EmbedBuilder()
      .setColor(WARNA)
      .setTitle(`${emoji}  ${(pet as any).petNama ?? PET_NAMA} lagi ${namaSuasana}`)
      .setDescription(`\`${bar}\`  ${Math.floor(pet.petKenyang)}/100`)
      .addFields(
        { name: 'Pengali XP buat SEMUA orang', value: `**x${kali}**`, inline: true },
        { name: 'Udah dikasih makan', value: `${(pet as any).petTotalMakan ?? 0} kali`, inline: true },
        { name: 'Cara ngerawat', value: `Kasih makan pakai \`/kasihmakan\` — **${PET_HARGA_MAKAN} XP** jadi **${PET_ISI_MAKAN} kenyang**.\nKenyangnya turun **${PET_LAPAR_PER_JAM} per jam**.`, inline: false }
      )
      .setFooter({ text: 'Kalau dia seneng, XP semua orang ikut naik.' });
    await inter.reply({ embeds: [embed] });
  }
};

// /kasihmakan
export const kasihMakanCommand = {
  data: new SlashCommandBuilder().setName('kasihmakan').setDescription(`Kasih makan ${PET_NAMA} pakai XP lo`),
  async executeSlash(inter: ChatInputCommandInteraction) {
    if (!PET_AKTIF) { await inter.reply({ content: 'Fitur peliharaan lagi dimatiin.', ephemeral: true }); return; }
    const userRecord = await prisma.user.findUnique({ where: { id: inter.user.id } });
    if (!userRecord) { await inter.reply({ content: 'Data lo belum ada.', ephemeral: true }); return; }
    const arkaUser = await getArkaUser(inter.user.id);
    const hari = hariIni();
    const petMakan: any = (arkaUser as any).petMakan ?? { hari: '', kali: 0 };
    if (petMakan.hari !== hari) { petMakan.hari = hari; petMakan.kali = 0; }
    if (petMakan.kali >= PET_MAKAN_MAKS_HARIAN) { await inter.reply({ content: `Lo udah kasih makan **${PET_MAKAN_MAKS_HARIAN} kali** hari ini. Biar yang lain kebagian.`, ephemeral: true }); return; }
    if (userRecord.xp < PET_HARGA_MAKAN) { await inter.reply({ content: `XP lo kurang. Butuh **${PET_HARGA_MAKAN}**, punya lo **${userRecord.xp.toLocaleString()}**.`, ephemeral: true }); return; }
    const pet = await kondisiPet();
    if (pet.petKenyang >= 100) { await inter.reply({ content: `${(pet as any).petNama ?? PET_NAMA} udah kenyang banget, ga mau makan lagi. Simpen XP lo.`, ephemeral: true }); return; }
    petMakan.kali += 1;
    const baruKenyang = Math.min(100.0, pet.petKenyang + PET_ISI_MAKAN);
    const { nama: namaSuasana, emoji, kali } = suasanaPet(baruKenyang);
    await prisma.$transaction([
      prisma.user.update({ where: { id: inter.user.id }, data: { xp: { decrement: PET_HARGA_MAKAN } } }),
      prisma.arkaGlobal.update({ where: { id: 1 }, data: { petKenyang: baruKenyang } })
    ]);
    await prisma.arkaUser.update({ where: { userId: inter.user.id }, data: { petMakan } as any });
    const panjang = 14;
    const n = Math.max(0, Math.min(panjang, Math.round(baruKenyang / 100 * panjang)));
    const bar = '▰'.repeat(n) + '▱'.repeat(panjang - n);
    const sisa = PET_MAKAN_MAKS_HARIAN - petMakan.kali;
    let kata = `${emoji} Lo kasih makan **${(pet as any).petNama ?? PET_NAMA}**. Kenyangnya sekarang **${Math.floor(baruKenyang)}/100**, dia lagi **${namaSuasana}**.\n\`${bar}\`\nPengali XP buat semua orang: **x${kali}**`;
    if (sisa > 0) kata += `\nSisa jatah lo hari ini: ${sisa} kali.`;
    await inter.reply(kata);
  }
};

// /kapsul
export const kapsulCommand = {
  data: new SlashCommandBuilder()
    .setName('kapsul')
    .setDescription('Titip pesan buat dibuka di masa depan')
    .addStringOption(o => o.setName('pesan').setDescription('Yang mau lo titipin').setRequired(true))
    .addIntegerOption(o => o.setName('hari').setDescription('Dibuka berapa hari lagi (default 30)').setMinValue(KAPSUL_HARI_MIN).setMaxValue(KAPSUL_HARI_MAKS)),
  async executeSlash(inter: ChatInputCommandInteraction) {
    if (!KAPSUL_AKTIF) { await inter.reply({ content: 'Fitur ini lagi dimatiin.', ephemeral: true }); return; }
    const pesan = inter.options.getString('pesan', true);
    const hari = inter.options.getInteger('hari') ?? 30;
    if (pesan.length > 900) { await inter.reply({ content: 'Kepanjangan, maksimal 900 huruf.', ephemeral: true }); return; }
    const global = await getArkaGlobal();
    const semua: any[] = (global as any).kapsul ?? [];
    const punya = semua.filter((k: any) => k.orang === inter.user.id && !k.dibuka);
    if (punya.length >= KAPSUL_MAKS_PER_ORANG) { await inter.reply({ content: `Lo udah punya **${punya.length} kapsul** yang belum kebuka.`, ephemeral: true }); return; }
    const bukaTanggal = new Date(Date.now() + hari * 86400000).toISOString().split('T')[0];
    semua.push({ orang: inter.user.id, isi: pesan, ditulis: hariIni(), buka: bukaTanggal, dibuka: false });
    await prisma.arkaGlobal.update({ where: { id: 1 }, data: { kapsul: semua } as any });
    const channelId = process.env.ARKA_CHANNEL_REKAP ?? process.env.ARKA_CHANNEL_ARENA;
    await inter.reply({ content: `⛵ Kapsul lo gua kunci. Dibuka **${bukaTanggal}** (${hari} hari lagi), dipost di ${channelId ? `<#${channelId}>` : 'channel rekap'}.\nIsinya ga ada yang bisa baca sampai hari itu.`, ephemeral: true });
  }
};

// /rantai
export const rantaiCommand = {
  data: new SlashCommandBuilder().setName('rantai').setDescription('Liat status rantai kata sekarang'),
  async executeSlash(inter: ChatInputCommandInteraction) {
    const global = await getArkaGlobal();
    const rantai: any = (global as any).rantai ?? {};
    const panjang = rantai.panjang ?? 0;
    const rekor = rantai.rekor ?? 0;
    const terakhir = rantai.terakhir || '(belum mulai)';
    const embed = new EmbedBuilder().setColor(WARNA).setTitle('🔠  Rantai Kata');
    if (panjang > 0) {
      const lanjut = terakhir !== '(belum mulai)' ? terakhir[terakhir.length - 1].toUpperCase() : '?';
      embed.setDescription(`Sekarang **${panjang}** kata tanpa putus.\nKata terakhir: **${terakhir}** → lanjut dari **${lanjut}**…`);
    } else {
      const chId = process.env.ARKA_CHANNEL_RANTAI;
      embed.setDescription(`Rantai lagi kosong. Ketik satu kata bebas di ${chId ? `<#${chId}>` : 'channel rantai'} buat mulai.`);
    }
    embed.addFields({ name: 'Rekor', value: `**${rekor}** kata`, inline: true });
    if (rantai.orang_terakhir && inter.guild) {
      const member = inter.guild.members.cache.get(rantai.orang_terakhir);
      if (member) embed.addFields({ name: 'Terakhir nulis', value: member.displayName, inline: true });
    }
    embed.setFooter({ text: `+${RANTAI_XP} XP per kata · bonus rekor +${RANTAI_XP_REKOR} XP` });
    await inter.reply({ embeds: [embed], ephemeral: true });
  }
};

// /hall
export const hallCommand = {
  data: new SlashCommandBuilder().setName('hall').setDescription('Hall of Fame juara musim musim lalu'),
  async executeSlash(inter: ChatInputCommandInteraction) {
    const global = await getArkaGlobal();
    const seasonData: any = (global as any).seasonData ?? { nomor: 1, mulai: hariIni(), hall: [] };
    const hall: any[] = seasonData.hall ?? [];
    let desc = `**Musim ${seasonData.nomor}** lagi jalan sejak ${seasonData.mulai}.`;
    if (seasonData.mulai) {
      const tutup = new Date(new Date(seasonData.mulai).getTime() + SEASON_BULAN * 30 * 86400000);
      desc += `\nTutup <t:${Math.floor(tutup.getTime() / 1000)}:R>.`;
    }
    const embed = new EmbedBuilder().setColor(WARNA).setTitle('🏛️  Hall of Fame').setDescription(desc);
    if (hall.length === 0) {
      embed.addFields({ name: 'Belum ada musim yang selesai', value: 'Musim pertama masih jalan. Yang masuk lima besar pas musim ini tutup bakal diabadiin di sini selamanya.', inline: false });
    } else {
      for (const catat of hall.slice(-5).reverse()) {
        const baris = catat.juara.map((j: any) => `\`${j.peringkat}.\` **${j.nama}** — ${j.xp.toLocaleString()} XP`).join('\n') || '_kosong_';
        embed.addFields({ name: `Musim ${catat.musim} · ${catat.mulai} → ${catat.selesai}`, value: baris, inline: false });
      }
    }
    await inter.reply({ embeds: [embed] });
  }
};

// /bantuan
export const bantuanCommand = {
  data: new SlashCommandBuilder().setName('bantuan').setDescription('Arka bisa apa aja?'),
  async executeSlash(inter: ChatInputCommandInteraction) {
    const embed = new EmbedBuilder()
      .setColor(WARNA)
      .setTitle('🌊  Arka bisa apa aja')
      .setDescription('XP dapet otomatis dari ngobrol di channel mana pun dan dari nongkrong bareng di voice.')
      .addFields(
        { name: 'Data diri', value: '`/profil` `/level` `/papan` `/rekap` `/cuaca` `/absen` `/absenbulan` `/rantai`', inline: false },
        { name: 'Main main', value: '`/tebak` `/suit` `/duel` `/trivia` `/hunt` `/koleksi` `/akinator` `/turnamen`', inline: false },
        { name: 'Misi & toko', value: '`/misi` `/quest` `/gantimisi` `/toko` `/beli` `/tas` `/pakai` `/riwayat` `/wishlist`', inline: false },
        { name: 'Bagi bagi', value: '`/kasih` — bagi XP.\n`/kasihitem` — oper barang dari tas lo.\n`/wishlist` — incar barang.', inline: false },
        { name: 'Bareng bareng', value: `\`/pet\` \`/kasihmakan\` — ${PET_NAMA} peliharaan server.\n\`/kapsul\` — titip pesan buat dibuka di masa depan.`, inline: false }
      );
    await inter.reply({ embeds: [embed], ephemeral: true });
  }
};

// /aturxp — ponytail: one update, no extras
export const aturxpCommand = {
  data: new SlashCommandBuilder()
    .setName('aturxp')
    .setDescription('Set XP member (admin)')
    .addUserOption(o => o.setName('member').setDescription('Target').setRequired(true))
    .addIntegerOption(o => o.setName('xp').setDescription('XP baru').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  async executeSlash(inter: ChatInputCommandInteraction) {
    const target = inter.options.getUser('member', true);
    const xp = inter.options.getInteger('xp', true);
    await prisma.user.upsert({ where: { id: target.id }, create: { id: target.id }, update: { xp } });
    await inter.reply({ content: `${target.tag} XP diatur ke ${xp}.`, ephemeral: true });
  }
};
