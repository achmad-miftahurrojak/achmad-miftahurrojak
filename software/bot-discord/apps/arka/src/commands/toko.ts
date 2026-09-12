import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, GuildMember } from 'discord.js';
import prisma from '../prisma';
import {
  WARNA, BARANG, BATAS_BELI, TOKO_KELOMPOK, TOKO_SUPER, TOKO_SUPER_PELUANG,
  KASIH_ITEM_AKTIF, KASIH_ITEM_HARIAN, KASIH_ITEM_DILARANG,
  WISHLIST_AKTIF, WISHLIST_MAKS, JULUKAN_HARI, PET_AKTIF, PET_NAMA
} from '../config';
import { getArkaGlobal } from '../core';

function hariIni() { return new Date().toISOString().split('T')[0]; }

export function cariBarang(kode: string) { return BARANG.find(b => b[0] === kode) ?? null; }

async function getArkaUser(userId: string) {
  await prisma.user.upsert({ where: { id: userId }, create: { id: userId }, update: {} });
  return prisma.arkaUser.upsert({ where: { userId }, create: { userId }, update: {} });
}

export async function stokToko() {
  const kunci = (() => {
    const d = new Date();
    const onejan = new Date(d.getFullYear(), 0, 1);
    const week = Math.ceil((((d.getTime() - onejan.getTime()) / 86400000) + onejan.getDay() + 1) / 7);
    return `${d.getFullYear()}-W${String(week).padStart(2, '0')}`;
  })();
  const global = await getArkaGlobal();
  const tokoData: any = (global as any).toko ?? {};
  if (tokoData.minggu === kunci) return tokoData.stok as string[];

  const pilihan: string[] = [];
  for (const [kelompok, [isi, berapa]] of Object.entries(TOKO_KELOMPOK)) {
    const diambil = [...isi].sort(() => Math.random() - 0.5).slice(0, Math.min(berapa, isi.length));
    pilihan.push(...diambil);
  }
  for (const kode of TOKO_SUPER) {
    if (Math.random() < TOKO_SUPER_PELUANG) pilihan.push(kode);
  }
  const urut: Record<string, number> = {};
  BARANG.forEach(b => { urut[b[0]] = b[3]; });
  pilihan.sort((a, b) => (urut[a] ?? 0) - (urut[b] ?? 0));

  await prisma.arkaGlobal.update({ where: { id: 1 }, data: { toko: { minggu: kunci, stok: pilihan, diumumkan: false } } as any });
  return pilihan;
}

function senin_depan() {
  const sekarang = new Date();
  const lagi = ((7 - sekarang.getDay()) % 7) || 7;
  const depan = new Date(sekarang.getTime() + lagi * 86400000);
  depan.setHours(0, 0, 0, 0);
  const sisa = depan.getTime() - sekarang.getTime();
  return { hari: Math.floor(sisa / 86400000), jam: Math.floor((sisa % 86400000) / 3600000) };
}

export async function embedToko(userId?: string) {
  const stok = await stokToko();
  let userData: any = null;
  let arkaUser: any = null;
  if (userId) {
    userData = await prisma.user.findUnique({ where: { id: userId } });
    arkaUser = await getArkaUser(userId);
  }

  const baris: string[] = [];
  for (const kode of stok) {
    const b = cariBarang(kode);
    if (!b) continue;
    const [, emoji, nama, harga, ket] = b;
    let cukup = '';
    let ekor = '';
    if (userData && arkaUser) {
      const barang: Record<string, number> = (arkaUser.barang as any) ?? {};
      const punya = barang[kode] ?? 0;
      cukup = userData.xp >= harga ? '' : '  ⚠️ XP lo belum cukup';
      ekor = punya > 0 ? `  ·  punya ${punya}` : '';
      if (BATAS_BELI[kode] !== undefined) {
        const udah = ((arkaUser as any).beliTotal ?? {})[kode] ?? 0;
        ekor += udah > 0 ? `  ·  **${udah}/${BATAS_BELI[kode]}** jatah kepakai` : `  ·  batas ${BATAS_BELI[kode]}x seumur hidup`;
      }
    } else if (BATAS_BELI[kode] !== undefined) {
      ekor = `  ·  batas ${BATAS_BELI[kode]}x seumur hidup`;
    }
    const langka = TOKO_SUPER.includes(kode) ? '  🌟 LANGKA' : '';
    baris.push(`${emoji}  **${nama}** — ${harga.toLocaleString()} XP${cukup}${langka}\n\u3000\u3000${ket}\n\u3000\u3000\`/beli ${kode}\`${ekor}`);
  }

  const libur = BARANG.filter(b => !stok.includes(b[0]));
  const { hari, jam } = senin_depan();
  const embed = new EmbedBuilder()
    .setColor(WARNA)
    .setTitle('🎣  Toko Pantai — stok minggu ini')
    .setDescription(baris.join('\n\n'));
  if (libur.length > 0) {
    embed.addFields({ name: 'Lagi ga dijual', value: libur.map(b => `${b[1]} ${b[2]}`).join(' · ') + '\nMungkin muncul lagi minggu depan.', inline: false });
  }
  const kaki = userData
    ? `XP lo sekarang: ${userData.xp.toLocaleString()} · stok diundi ulang ${hari} hari ${jam} jam lagi`
    : `Stok diundi ulang ${hari} hari ${jam} jam lagi · ketik /toko buat liat XP dan jatah beli lo`;
  embed.setFooter({ text: kaki });
  return embed;
}

// /toko
export const tokoCommand = {
  data: new SlashCommandBuilder().setName('toko').setDescription('Tukar XP jadi barang'),
  async executeSlash(inter: ChatInputCommandInteraction) {
    await inter.deferReply();
    const embed = await embedToko(inter.user.id);
    await inter.editReply({ embeds: [embed] });
  }
};

// /beli
export const beliCommand = {
  data: new SlashCommandBuilder()
    .setName('beli')
    .setDescription('Beli barang di toko')
    .addStringOption(o => o.setName('barang').setDescription('Kode barangnya, liat di /toko').setRequired(true)
      .addChoices(...BARANG.map(b => ({ name: `${b[1]} ${b[2]} — ${b[3]}`, value: b[0] })))),
  async executeSlash(inter: ChatInputCommandInteraction) {
    const kode = inter.options.getString('barang', true);
    const isiBarang = cariBarang(kode);
    if (!isiBarang) { await inter.reply({ content: 'Barangnya ga ada.', ephemeral: true }); return; }
    const [, emoji, nama, harga] = isiBarang;
    const stok = await stokToko();
    if (!stok.includes(kode)) {
      const { hari, jam } = senin_depan();
      await inter.reply({ content: `${emoji} **${nama}** lagi ga dijual minggu ini. Stok diundi ulang ${hari} hari ${jam} jam lagi.\nLiat yang lagi ada di \`/toko\`.`, ephemeral: true });
      return;
    }
    const user = await prisma.user.findUnique({ where: { id: inter.user.id } });
    if (!user) { await inter.reply({ content: 'Data lo belum ada.', ephemeral: true }); return; }
    const arkaUser = await getArkaUser(inter.user.id);
    const batas = BATAS_BELI[kode];
    if (batas !== undefined) {
      const udah = ((arkaUser as any).beliTotal ?? {})[kode] ?? 0;
      if (udah >= batas) { await inter.reply({ content: `${emoji} **${nama}** cuma boleh dibeli **${batas} kali seumur hidup**, dan lo udah pakai semua jatahnya.`, ephemeral: true }); return; }
    }
    if (user.xp < harga) { await inter.reply({ content: `XP lo kurang **${(harga - user.xp).toLocaleString()}** lagi buat ${nama}.`, ephemeral: true }); return; }

    const barang: Record<string, number> = (arkaUser.barang as any) ?? {};
    const efek: any = (arkaUser.efek as any) ?? {};
    const beliTotal: Record<string, number> = (arkaUser as any).beliTotal ?? {};
    beliTotal[kode] = (beliTotal[kode] ?? 0) + 1;

    let tambahan = 'Barangnya kepakai sendiri nanti, ga usah diapa apain.';
    if (kode === 'paus') {
      efek.paus_sampai = new Date(Date.now() + 86400000).toISOString();
      tambahan = `🐋 Langsung nyala. Semua XP lo naik 50 persen selama 24 jam.${batas !== undefined ? `\nSisa jatah beli: **${batas - beliTotal[kode]}** kali lagi.` : ''}`;
    } else {
      barang[kode] = (barang[kode] ?? 0) + 1;
    }

    const riwayat: any[] = (arkaUser as any).riwayatBeli ?? [];
    riwayat.push({ kode, harga, kapan: new Date().toLocaleString('id-ID') });
    if (riwayat.length > 100) riwayat.splice(0, riwayat.length - 100);

    await prisma.$transaction([
      prisma.user.update({ where: { id: inter.user.id }, data: { xp: { decrement: harga } } }),
      prisma.arkaUser.update({ where: { userId: inter.user.id }, data: { barang, efek, beliTotal, riwayatBeli: riwayat } as any })
    ]);
    await inter.reply(`${emoji} **${nama}** kebeli. Sisa XP lo **${(user.xp - harga).toLocaleString()}**.\n${tambahan}`);
  }
};

// /tas
export const tasCommand = {
  data: new SlashCommandBuilder().setName('tas').setDescription('Liat barang yang lo punya'),
  async executeSlash(inter: ChatInputCommandInteraction) {
    const user = await prisma.user.findUnique({ where: { id: inter.user.id } });
    const arkaUser = await getArkaUser(inter.user.id);
    const barang: Record<string, number> = (arkaUser.barang as any) ?? {};
    const efek: any = (arkaUser.efek as any) ?? {};
    const baris = Object.entries(barang).map(([kode, jumlah]) => {
      const b = cariBarang(kode);
      return b ? `${b[1]}  **${b[2]}** × ${jumlah}\n\u3000\u3000${b[4]}` : null;
    }).filter(Boolean);
    const aktif: string[] = [];
    if (efek.umpan > 0) aktif.push(`🪝 Umpan Emas nyala, sisa **${efek.umpan}** jelajah`);
    if (efek.cepat_sampai && new Date(efek.cepat_sampai) > new Date()) {
      const sisa = Math.floor((new Date(efek.cepat_sampai).getTime() - Date.now()) / 60000);
      aktif.push(`⏩ Air Pasang nyala, sisa **${sisa} menit**`);
    }
    const embed = new EmbedBuilder()
      .setColor(WARNA)
      .setTitle(`🎒  Tas ${inter.user.displayName}`)
      .setDescription(baris.length > 0 ? baris.join('\n\n') : 'Tasnya kosong. Beli di `/toko`.');
    if (aktif.length > 0) embed.addFields({ name: 'Lagi jalan', value: aktif.join('\n'), inline: false });
    embed.setFooter({ text: `XP lo: ${user?.xp.toLocaleString() ?? 0}` });
    await inter.reply({ embeds: [embed] });
  }
};

// /riwayat
export const riwayatCommand = {
  data: new SlashCommandBuilder().setName('riwayat').setDescription('Liat riwayat belanjo lo'),
  async executeSlash(inter: ChatInputCommandInteraction) {
    const arkaUser = await getArkaUser(inter.user.id);
    const riwayat: any[] = (arkaUser as any).riwayatBeli ?? [];
    if (riwayat.length === 0) { await inter.reply({ content: 'Lo belum pernah belanja apa apa.', ephemeral: true }); return; }
    const baris = riwayat.slice(-20).reverse().map(item => {
      const b = cariBarang(item.kode);
      return `${item.kapan} - ${b ? b[1] : '📦'} **${b ? b[2] : item.kode}** (${item.harga} XP)`;
    });
    const embed = new EmbedBuilder().setColor(WARNA).setTitle(`📜 Riwayat Belanja ${inter.user.displayName}`).setDescription(baris.join('\n'));
    await inter.reply({ embeds: [embed], ephemeral: true });
  }
};

// /kasihitem
export const kasihItemCommand = {
  data: new SlashCommandBuilder()
    .setName('kasihitem')
    .setDescription('Kasih barang dari tas lo ke orang lain')
    .addUserOption(o => o.setName('orang').setDescription('Mau dikasih ke siapa').setRequired(true))
    .addStringOption(o => o.setName('barang').setDescription('Barang yang mana').setRequired(true)
      .addChoices(...BARANG.filter(b => !KASIH_ITEM_DILARANG.includes(b[0])).map(b => ({ name: `${b[1]} ${b[2]}`, value: b[0] }))))
    .addIntegerOption(o => o.setName('jumlah').setDescription('Berapa biji').setMinValue(1)),
  async executeSlash(inter: ChatInputCommandInteraction) {
    if (!KASIH_ITEM_AKTIF) { await inter.reply({ content: 'Fitur ini lagi dimatiin.', ephemeral: true }); return; }
    const target = inter.options.getMember('orang') as GuildMember;
    const kode = inter.options.getString('barang', true);
    const jumlah = inter.options.getInteger('jumlah') ?? 1;
    if (target.user.bot) { await inter.reply({ content: 'Bot ga punya tas.', ephemeral: true }); return; }
    if (target.id === inter.user.id) { await inter.reply({ content: 'Mindahin barang dari tas lo ke tas lo sendiri. Buat apa.', ephemeral: true }); return; }
    if (KASIH_ITEM_DILARANG.includes(kode)) { await inter.reply({ content: 'Barang ini nempel ke orangnya, ga bisa dioper.', ephemeral: true }); return; }
    const arkaUser = await getArkaUser(inter.user.id);
    const tas: Record<string, number> = (arkaUser.barang as any) ?? {};
    const punya = tas[kode] ?? 0;
    const info = cariBarang(kode)!;
    if (punya < jumlah) { await inter.reply({ content: `Lo cuma punya **${punya}** ${info[1]} ${info[2]}. Cek \`/tas\`.`, ephemeral: true }); return; }
    const hari = hariIni();
    const kasihItemHarian: any = (arkaUser as any).kasihItemHarian ?? { hari: '', jumlah: 0 };
    if (kasihItemHarian.hari !== hari) { kasihItemHarian.hari = hari; kasihItemHarian.jumlah = 0; }
    const sisa = KASIH_ITEM_HARIAN - kasihItemHarian.jumlah;
    if (jumlah > sisa) { await inter.reply({ content: `Sisa jatah lo hari ini **${sisa} barang**. Batasnya ${KASIH_ITEM_HARIAN} per hari.`, ephemeral: true }); return; }
    tas[kode] -= jumlah;
    if (!tas[kode]) delete tas[kode];
    kasihItemHarian.jumlah += jumlah;
    const kasihKe: string[] = (arkaUser.kasihKe as any) ?? [];
    if (!kasihKe.includes(target.id)) kasihKe.push(target.id);

    const targetArka = await getArkaUser(target.id);
    const tasTujuan: Record<string, number> = (targetArka.barang as any) ?? {};
    tasTujuan[kode] = (tasTujuan[kode] ?? 0) + jumlah;

    await prisma.$transaction([
      prisma.arkaUser.update({ where: { userId: inter.user.id }, data: { barang: tas, kasihKe, kasihItemHarian } as any }),
      prisma.arkaUser.update({ where: { userId: target.id }, data: { barang: tasTujuan } as any })
    ]);

    const embed = new EmbedBuilder()
      .setColor(WARNA)
      .setTitle('🎁  Barang dioper')
      .setDescription(`${inter.user.toString()} ngasih **${jumlah}× ${info[1]} ${info[2]}** ke ${target.toString()}.`)
      .addFields({ name: 'Gunanya', value: info[4], inline: false })
      .setFooter({ text: `Sisa jatah ${inter.user.displayName} hari ini: ${KASIH_ITEM_HARIAN - kasihItemHarian.jumlah}` });
    await inter.reply({ embeds: [embed] });
    target.send(`${inter.user.displayName} ngasih lo **${jumlah}× ${info[1]} ${info[2]}** di ${inter.guild?.name}.\n${info[4]}\nCek \`/tas\`.`).catch(() => {});
  }
};

// /wishlist
export const wishlistCommand = {
  data: new SlashCommandBuilder()
    .setName('wishlist')
    .setDescription('Barang incaran lo, dikabarin kalau masuk stok')
    .addStringOption(o => o.setName('aksi').setDescription('Mau ngapain').setRequired(false)
      .addChoices({ name: 'liat', value: 'liat' }, { name: 'tambah', value: 'tambah' }, { name: 'hapus', value: 'hapus' }))
    .addStringOption(o => o.setName('barang').setDescription('Barang yang mana').setRequired(false)
      .addChoices(...BARANG.map(b => ({ name: `${b[1]} ${b[2]}`, value: b[0] })))),
  async executeSlash(inter: ChatInputCommandInteraction) {
    if (!WISHLIST_AKTIF) { await inter.reply({ content: 'Fitur ini lagi dimatiin.', ephemeral: true }); return; }
    const pilih = inter.options.getString('aksi') ?? 'liat';
    const arkaUser = await getArkaUser(inter.user.id);
    const daftar: string[] = (arkaUser as any).wishlist ?? [];
    const stok = await stokToko();

    if ((pilih === 'tambah' || pilih === 'hapus') && !inter.options.getString('barang')) {
      await inter.reply({ content: 'Isi juga barangnya mau yang mana.', ephemeral: true }); return;
    }
    if (pilih === 'tambah') {
      const kode = inter.options.getString('barang', true);
      if (daftar.includes(kode)) { await inter.reply({ content: `**${cariBarang(kode)![2]}** udah ada di incaran lo.`, ephemeral: true }); return; }
      if (daftar.length >= WISHLIST_MAKS) { await inter.reply({ content: `Incaran lo udah ${WISHLIST_MAKS} barang. Hapus dulu salah satu.`, ephemeral: true }); return; }
      daftar.push(kode);
      await prisma.arkaUser.update({ where: { userId: inter.user.id }, data: { wishlist: daftar } as any });
      const info = cariBarang(kode)!;
      let pesan = `${info[1]} **${info[2]}** masuk incaran lo. Gua DM kalau dia nongol di stok mingguan.`;
      if (stok.includes(kode)) pesan += `\n\nEh, dia **lagi dijual minggu ini**. \`/beli ${kode}\`.`;
      await inter.reply({ content: pesan, ephemeral: true }); return;
    }
    if (pilih === 'hapus') {
      const kode = inter.options.getString('barang', true);
      if (!daftar.includes(kode)) { await inter.reply({ content: 'Itu ga ada di incaran lo.', ephemeral: true }); return; }
      daftar.splice(daftar.indexOf(kode), 1);
      await prisma.arkaUser.update({ where: { userId: inter.user.id }, data: { wishlist: daftar } as any });
      await inter.reply({ content: `**${cariBarang(kode)![2]}** dicoret dari incaran.`, ephemeral: true }); return;
    }
    if (daftar.length === 0) { await inter.reply({ content: 'Incaran lo masih kosong.\nIsi pakai `/wishlist aksi:tambah barang:...`.', ephemeral: true }); return; }
    const userData = await prisma.user.findUnique({ where: { id: inter.user.id } });
    const baris = daftar.map(kode => {
      const info = cariBarang(kode);
      if (!info) return null;
      const tanda = stok.includes(kode) ? '🟢 lagi dijual' : `⚪ diundi ulang ${senin_depan().hari}h ${senin_depan().jam}j lagi`;
      const kurang = (userData?.xp ?? 0) >= info[3] ? '' : `  ·  kurang ${(info[3] - (userData?.xp ?? 0)).toLocaleString()} XP`;
      return `${info[1]} **${info[2]}** — ${info[3].toLocaleString()} XP  ·  ${tanda}${kurang}`;
    }).filter(Boolean);
    const embed = new EmbedBuilder().setColor(WARNA).setTitle('⭐  Barang incaran lo').setDescription(baris.join('\n')).setFooter({ text: `${daftar.length}/${WISHLIST_MAKS} · gua DM kalau ada yang masuk stok` });
    await inter.reply({ embeds: [embed], ephemeral: true });
  }
};

// /pakai
export const pakaiCommand = {
  data: new SlashCommandBuilder()
    .setName('pakai')
    .setDescription('Pakai barang sosial yang lo punya')
    .addStringOption(o => o.setName('barang').setDescription('Barang mana').setRequired(true)
      .addChoices({ name: 'Julukan Sendiri', value: 'julukan' }, { name: 'Hak Nama Nemo', value: 'namapet' }))
    .addStringOption(o => o.setName('nilai').setDescription('Isian yang dibutuhin (nama + warna hex untuk julukan)').setRequired(true)),
  async executeSlash(inter: ChatInputCommandInteraction) {
    const kode = inter.options.getString('barang', true);
    const nilai = inter.options.getString('nilai', true);
    const arkaUser = await getArkaUser(inter.user.id);
    const tas: Record<string, number> = (arkaUser.barang as any) ?? {};
    if ((tas[kode] ?? 0) < 1) {
      const info = cariBarang(kode);
      await inter.reply({ content: `Lo ga punya ${info ? info[1] : ''} **${info ? info[2] : kode}**. Cek \`/toko\`.`, ephemeral: true }); return;
    }
    if (kode === 'namapet') {
      if (!PET_AKTIF) { await inter.reply({ content: 'Peliharaan lagi dimatiin.', ephemeral: true }); return; }
      const namaBaru = nilai.trim().slice(0, 20);
      if (namaBaru.length < 2 || !namaBaru.replace(/\s/g, '').match(/^[a-zA-Z0-9]+$/)) {
        await inter.reply({ content: 'Namanya 2 sampai 20 huruf, huruf sama angka doang.', ephemeral: true }); return;
      }
      const global = await (await import('../core')).getArkaGlobal();
      const namaPet = (global as any).petNama ?? PET_NAMA;
      await prisma.arkaGlobal.update({ where: { id: 1 }, data: { petNama: namaBaru } as any });
      tas[kode] -= 1;
      if (!tas[kode]) delete tas[kode];
      await prisma.arkaUser.update({ where: { userId: inter.user.id }, data: { barang: tas } as any });
      await inter.reply(`🐣 **${namaPet}** sekarang namanya **${namaBaru}**.\n${inter.user.toString()} yang ngasih nama. Sekarang seluruh server manggil dia gitu.`); return;
    }
    // julukan
    const pecah = nilai.split(' ');
    const namaRole = pecah.slice(0, -1).join(' ').trim().slice(0, 24) || pecah.join(' ').trim().slice(0, 24);
    const warnaHex = pecah.length > 1 ? pecah[pecah.length - 1] : '4AA8D8';
    let nilaiWarna: number;
    try { nilaiWarna = parseInt(warnaHex.replace('#', ''), 16); } catch {
      await inter.reply({ content: 'Formatnya: `nama julukan WARNAHEX`\nContoh: `/pakai julukan nilai:Raja Pantai FF6B35`', ephemeral: true }); return;
    }
    if (namaRole.length < 2) { await inter.reply({ content: 'Nama julukannya kependekan.', ephemeral: true }); return; }
    await inter.deferReply();
    const efek: any = (arkaUser.efek as any) ?? {};
    if (efek.julukan_role && inter.guild) {
      const roleLama = inter.guild.roles.cache.get(efek.julukan_role);
      if (roleLama) await roleLama.delete('Julukan diganti').catch(() => {});
    }
    try {
      const role = await inter.guild!.roles.create({ name: namaRole, color: nilaiWarna, reason: `Julukan dibeli ${inter.user.tag}` });
      await (inter.member as GuildMember).roles.add(role, 'Julukan');
      tas[kode] -= 1;
      if (!tas[kode]) delete tas[kode];
      const sampai = new Date(Date.now() + JULUKAN_HARI * 86400000);
      efek.julukan_role = role.id;
      efek.julukan_sampai = sampai.toISOString();
      await prisma.arkaUser.update({ where: { userId: inter.user.id }, data: { barang: tas, efek } as any });
      await inter.editReply(`🏷️ ${inter.user.toString()} sekarang **${namaRole}**.\nBertahan ${JULUKAN_HARI} hari, sampai <t:${Math.floor(sampai.getTime() / 1000)}:D>.`);
    } catch (e: any) {
      await inter.editReply(`Ditolak Discord: ${e.message}`);
    }
  }
};
