import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  PermissionFlagsBits,
  Colors,
  EmbedBuilder,
  TextChannel
} from 'discord.js';
import { prisma } from '../index';
import { askAI, AiMessage } from '../modules/ai';
import { getRateLimitInfo } from '../modules/rateLimit';
import { getHistory, clearHistory } from '../modules/history';
import { checkRateLimit } from '../modules/rateLimit';
import { splitLong } from '../utils';

// ─── /halo ────────────────────────────────────────────────────────────────────

export const haloData = new SlashCommandBuilder()
  .setName('halo')
  .setDescription('Cek bot masih idup apa engga');

export async function haloSlash(interaction: ChatInputCommandInteraction) {
  const history = await getHistory(interaction.channelId);
  await interaction.reply(`idup kok, santai. gua inget ${history.length} pesan terakhir di sini.`);
}

// ─── /lupa ────────────────────────────────────────────────────────────────────

export const lupaData = new SlashCommandBuilder()
  .setName('lupa')
  .setDescription('Bikin Dirga lupa obrolan di channel ini')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages);

export async function lupaSlash(interaction: ChatInputCommandInteraction) {
  const history = await getHistory(interaction.channelId);
  const jumlah = history.length;
  await clearHistory(interaction.channelId);

  if (jumlah > 0) {
    await interaction.reply(`oke, ${jumlah} pesan terakhir gua lupain. mulai dari kosong lagi.`);
  } else {
    await interaction.reply({ content: 'emang belum ada yang gua inget di sini.', ephemeral: true });
  }
}

// ─── /ringkas ─────────────────────────────────────────────────────────────────

export const ringkasData = new SlashCommandBuilder()
  .setName('ringkas')
  .setDescription('Ringkas obrolan terakhir di channel ini');

export async function ringkasSlash(interaction: ChatInputCommandInteraction) {
  const history = await getHistory(interaction.channelId);
  const userMessages = history.filter(m => m.role === 'user');

  if (userMessages.length < 4) {
    await interaction.reply({ content: 'obrolannya masih dikit, ga ada yang perlu diringkas.', ephemeral: true });
    return;
  }

  const { allowed, reason } = checkRateLimit(interaction.user.id);
  if (!allowed) {
    await interaction.reply({ content: reason!, ephemeral: true });
    return;
  }

  await interaction.deferReply();

  const prompt: AiMessage[] = [
    ...history,
    {
      role: 'user',
      parts: [{ text: 'Ringkas obrolan di atas jadi 3 sampai 5 poin pendek. Sebut siapa ngomong apa. Cuma poinnya aja, ga usah kasih pengantar atau penutup. Kalau obrolannya cuma basa basi, bilang aja ga ada yang penting.' }]
    }
  ];

  const result = await askAI(prompt);
  if (!result) {
    await interaction.followUp('lagi ga bisa mikir, coba lagi nanti.');
    return;
  }

  const parts = splitLong(result);
  await interaction.followUp(parts[0]);
  const channel = interaction.channel as TextChannel;
  for (const part of parts.slice(1)) {
    await channel.send(part);
  }
}

// ─── /topik ───────────────────────────────────────────────────────────────────

const TOPIK_CADANGAN = [
  'pertanyaan receh: nasi goreng paling enak itu yang pakai telur ceplok apa telur orak arik',
  'kalau lo bisa balik ke satu hari di masa lalu cuma buat ngerasain lagi, hari apa',
  'film atau series apa yang lo tonton ulang terus dan ga pernah bosen',
  'hal paling ga penting yang lo tau detailnya banget itu apa',
  'kebiasaan aneh lo yang orang lain ga ngerti apa'
];

export const topikData = new SlashCommandBuilder()
  .setName('topik')
  .setDescription('Minta Dirga lempar topik obrolan baru');

export async function topikSlash(interaction: ChatInputCommandInteraction) {
  const { allowed, reason } = checkRateLimit(interaction.user.id);
  if (!allowed) {
    await interaction.reply({ content: reason!, ephemeral: true });
    return;
  }

  await interaction.deferReply();

  const history = await getHistory(interaction.channelId);
  const recentHistory = history.slice(-6);
  const prompt: AiMessage[] = [
    ...recentHistory,
    {
      role: 'user',
      parts: [{ text: 'Lempar satu topik obrolan baru yang bikin orang pengen nimbrung. Nyambung sama suasana obrolan di atas kalau ada, kalau ga ada ya bebas. Satu atau dua kalimat, jangan formal, jangan nyebut kalau server lagi sepi.' }]
    }
  ];

  const result = await askAI(prompt);
  const text = result || TOPIK_CADANGAN[Math.floor(Math.random() * TOPIK_CADANGAN.length)];
  await interaction.followUp(splitLong(text)[0]);
}

// ─── /ngobroldi ───────────────────────────────────────────────────────────────

export const ngobroldiData = new SlashCommandBuilder()
  .setName('ngobroldi')
  .setDescription('Atur channel tempat Dirga nyaut tanpa di-mention')
  .addChannelOption(opt =>
    opt.setName('channel')
      .setDescription('Kosongin kalau mau dimatiin')
      .setRequired(false))
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

export async function ngobroldiSlash(interaction: ChatInputCommandInteraction) {
  const channel = interaction.options.getChannel('channel') as TextChannel | null;

  let settings = await prisma.dirgaSettings.findFirst();
  if (!settings) {
    settings = await prisma.dirgaSettings.create({ data: {} });
  }

  await prisma.dirgaSettings.update({
    where: { id: settings.id },
    data: { channelNgobrolId: channel?.id || null }
  });

  if (channel) {
    await interaction.reply(`oke, mulai sekarang gua nyaut sendiri di ${channel} tanpa perlu di-mention.`);
  } else {
    await interaction.reply('channel ngobrol bebas gua matiin. sekarang gua cuma nyaut kalau di-mention atau dibales.');
  }
}

// ─── /jatah ───────────────────────────────────────────────────────────────────

const JATAH_PER_JAM = 20;
const JEDA_DETIK = 5;

export const jatahData = new SlashCommandBuilder()
  .setName('jatah')
  .setDescription('Sisa kuota nanya lo jam ini');

export async function jatahSlash(interaction: ChatInputCommandInteraction) {
  const { remaining, nextReset } = getRateLimitInfo(interaction.user.id);
  const bar = 12;
  const filled = Math.round((remaining / JATAH_PER_JAM) * bar);
  const batang = '▰'.repeat(filled) + '▱'.repeat(bar - filled);

  const embed = new EmbedBuilder()
    .setTitle('Jatah nanya lo')
    .setDescription(`\`${batang}\`  **${remaining}** dari ${JATAH_PER_JAM}`)
    .setColor(remaining > 5 ? Colors.Green : Colors.Orange)
    .addFields({ name: 'Jeda antar tanya', value: `${JEDA_DETIK} detik`, inline: true })
    .setFooter({ text: 'Batas ini biar satu orang ga ngabisin jatah harian buat seluruh server' });

  if (nextReset) {
    embed.addFields({ name: 'Jatah mulai balik', value: `<t:${nextReset}:R>`, inline: true });
  }

  await interaction.reply({ embeds: [embed], ephemeral: true });
}

// ─── /terjemah ────────────────────────────────────────────────────────────────

export const terjemahData = new SlashCommandBuilder()
  .setName('terjemah')
  .setDescription('Terjemahin teks')
  .addStringOption(opt =>
    opt.setName('teks').setDescription('Yang mau diterjemahin').setRequired(true))
  .addStringOption(opt =>
    opt.setName('ke')
      .setDescription('Mau ke bahasa apa')
      .setRequired(true)
      .addChoices(
        { name: 'Indonesia', value: 'Indonesia' },
        { name: 'Inggris', value: 'Inggris' },
        { name: 'Korea', value: 'Korea' },
        { name: 'Jepang', value: 'Jepang' },
        { name: 'Arab', value: 'Arab' }
      ));

export async function terjemahSlash(interaction: ChatInputCommandInteraction) {
  const teks = interaction.options.getString('teks', true);
  const ke = interaction.options.getString('ke', true);

  if (teks.length > 1000) {
    await interaction.reply({ content: 'kepanjangan, maksimal 1000 huruf.', ephemeral: true });
    return;
  }

  const { allowed, reason } = checkRateLimit(interaction.user.id);
  if (!allowed) {
    await interaction.reply({ content: reason!, ephemeral: true });
    return;
  }

  await interaction.deferReply();

  const needsRomaji = ['Korea', 'Jepang', 'Arab'].includes(ke);
  const extra = needsRomaji
    ? '\nBaris kedua: cara bacanya pakai huruf latin.\nBaris ketiga: satu catatan singkat soal susunan kalimatnya atau kata yang menarik.'
    : '';

  const TRANSLATOR_SYSTEM = 'Kamu adalah asisten penerjemah bahasa yang sangat profesional dan ketat. Tugasmu hanya menerjemahkan teks. ATURAN MUTLAK: Jika teks yang diberikan mengandung kata-kata kasar, makian, vulgar, atau pornografi (contoh: memek, kontol, anjing, bangsat, dll), kamu WAJIB menolak perintah ini dengan HANYA membalas teks berikut tanpa tambahan apa pun:\n⚠️ Maaf, kata tersebut terlalu tidak pantas untuk diterjemahkan di channel publik.';

  const prompt: AiMessage[] = [{
    role: 'user',
    parts: [{ text: `Tugas: Terjemahkan teks berikut ke bahasa ${ke}:\n\n${teks}\n\nBaris pertama: hasil terjemahannya doang.${extra}\nJangan kasih pengantar, jangan kasih tanda kutip.` }]
  }];

  const result = await askAI(prompt, '', TRANSLATOR_SYSTEM);
  if (!result) {
    await interaction.followUp('lagi ga bisa mikir, coba lagi nanti.');
    return;
  }

  const displayText = result.includes('terlalu tidak pantas') ? '[Disensor]' : teks.substring(0, 1000);

  const embed = new EmbedBuilder()
    .setTitle(`Terjemahan ke ${ke}`)
    .setDescription(splitLong(result, 3900)[0])
    .setColor(Colors.Blurple)
    .addFields({ name: 'Aslinya', value: displayText, inline: false });

  await interaction.followUp({ embeds: [embed] });
}

// ─── /ingat ───────────────────────────────────────────────────────────────────

const PROFIL_MAKS_CATATAN = 6;
const PROFIL_PANJANG_MAKS = 120;

export const ingatData = new SlashCommandBuilder()
  .setName('ingat')
  .setDescription('Kasih tau Dirga sesuatu soal lo')
  .addStringOption(opt =>
    opt.setName('catatan').setDescription('Hal yang mau dia inget soal lo').setRequired(true));

export async function ingatSlash(interaction: ChatInputCommandInteraction) {
  const catatan = interaction.options.getString('catatan', true);

  if (catatan.length > PROFIL_PANJANG_MAKS) {
    await interaction.reply({ content: `kepanjangan, maksimal ${PROFIL_PANJANG_MAKS} huruf.`, ephemeral: true });
    return;
  }

  // Ensure user exists first
  await prisma.user.upsert({
    where: { id: interaction.user.id },
    update: {},
    create: { id: interaction.user.id }
  });

  let profile = await prisma.dirgaProfile.findUnique({ where: { userId: interaction.user.id } });
  if (!profile) {
    profile = await prisma.dirgaProfile.create({
      data: { userId: interaction.user.id, nama: interaction.user.displayName, catatan: [] }
    });
  }

  const catatanList = [...profile.catatan];
  if (catatanList.length >= PROFIL_MAKS_CATATAN) catatanList.shift();
  catatanList.push(catatan);

  await prisma.dirgaProfile.update({
    where: { userId: interaction.user.id },
    data: { catatan: catatanList, nama: interaction.user.displayName }
  });

  await interaction.reply({
    content: `oke, gua inget: *${catatan}*\nsekarang gua nyatet ${catatanList.length} hal soal lo. liat semua pakai \`/ingatan\`.`,
    ephemeral: true
  });
}

// ─── /ingatan ─────────────────────────────────────────────────────────────────

export const ingatanData = new SlashCommandBuilder()
  .setName('ingatan')
  .setDescription('Liat apa aja yang Dirga inget soal lo');

export async function ingatanSlash(interaction: ChatInputCommandInteraction) {
  const profile = await prisma.dirgaProfile.findUnique({ where: { userId: interaction.user.id } });

  if (!profile || profile.catatan.length === 0) {
    await interaction.reply({
      content: 'gua belum inget apa apa soal lo. ngobrol dulu sana, atau kasih tau langsung pakai `/ingat`.',
      ephemeral: true
    });
    return;
  }

  const baris = profile.catatan.map((c, i) => `\`${i + 1}.\` ${c}`).join('\n');
  const embed = new EmbedBuilder()
    .setTitle('Yang gua inget soal lo')
    .setDescription(baris)
    .setColor(Colors.Blurple)
    .setFooter({ text: 'Hapus semua pakai /lupakan · ini cuma lo yang bisa liat' });

  await interaction.reply({ embeds: [embed], ephemeral: true });
}

// ─── /lupakan ─────────────────────────────────────────────────────────────────

export const lupakanData = new SlashCommandBuilder()
  .setName('lupakan')
  .setDescription('Hapus semua yang Dirga inget soal lo');

export async function lupakanSlash(interaction: ChatInputCommandInteraction) {
  const profile = await prisma.dirgaProfile.findUnique({ where: { userId: interaction.user.id } });

  if (!profile) {
    await interaction.reply({ content: 'emang ga ada yang gua inget.', ephemeral: true });
    return;
  }

  const jumlah = profile.catatan.length;
  await prisma.dirgaProfile.delete({
    where: { userId: interaction.user.id }
  });

  await interaction.reply({ content: `oke, profil lo dan ${jumlah} catatan di dalamnya udah gua hapus total. kita mulai dari awal lagi.`, ephemeral: true });
}

// ─── /revive ──────────────────────────────────────────────────────────────────

export const reviveData = new SlashCommandBuilder()
  .setName('revive')
  .setDescription('Ikut atau keluar dari panggilan kalau server lagi sepi');

export async function reviveSlash(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) {
    await interaction.reply({ content: 'Cuma bisa dipakai di dalam server.', ephemeral: true });
    return;
  }

  const settings = await prisma.dirgaSettings.findFirst();
  const roleId = settings?.roleReviveId;
  const role = roleId ? interaction.guild.roles.cache.get(roleId) : null;

  if (!role) {
    await interaction.reply({ content: 'Role revive belum diatur. Admin bisa set lewat `/ngobroldi`.', ephemeral: true });
    return;
  }

  const member = await interaction.guild.members.fetch(interaction.user.id);
  try {
    if (member.roles.cache.has(role.id)) {
      await member.roles.remove(role);
      await interaction.reply({ content: 'Sip, lo ga bakal kena ping dari Dirga lagi.', ephemeral: true });
    } else {
      await member.roles.add(role);
      await interaction.reply({ content: 'Mantap, lo masuk daftar sasaran ping. Kalo lagi sepi ntar gua cari.', ephemeral: true });
    }
  } catch {
    await interaction.reply({ content: 'gua ga punya izin buat ngatur role itu. minta admin cek posisi role gua ya.', ephemeral: true });
  }
}

// ─── /ajakmabar ───────────────────────────────────────────────────────────────

export const ajakmabarData = new SlashCommandBuilder()
  .setName('ajakmabar')
  .setDescription('Suruh Dirga nge-tag dan ngajak orang mabar')
  .addUserOption(opt => opt.setName('siapa1').setDescription('Siapa yang mau lu ajak? (Wajib)').setRequired(true))
  .addUserOption(opt => opt.setName('siapa2').setDescription('Ada lagi yang mau diajak? (Opsional)').setRequired(false))
  .addUserOption(opt => opt.setName('siapa3').setDescription('Satu lagi deh? (Opsional)').setRequired(false))
  .addStringOption(opt => opt.setName('game').setDescription('Game apa nih? (Opsional)').setRequired(false))
  .addStringOption(opt => opt.setName('pesan').setDescription('Ada pesan khusus dari lu? (Opsional)').setRequired(false));

export async function ajakmabarSlash(interaction: ChatInputCommandInteraction) {
  const { allowed, reason } = checkRateLimit(interaction.user.id);
  if (!allowed) {
    await interaction.reply({ content: reason!, ephemeral: true });
    return;
  }

  await interaction.deferReply();

  const targets = [
    interaction.options.getUser('siapa1'),
    interaction.options.getUser('siapa2'),
    interaction.options.getUser('siapa3')
  ].filter(Boolean);

  const mentions = targets.map(u => `<@${u!.id}>`).join(' ');
  const game = interaction.options.getString('game') || '';
  const pesanTambahan = interaction.options.getString('pesan') || '';

  const promptGame = game ? ` game ${game}` : ' game bebas';
  const promptTambahan = pesanTambahan ? ` Pesan tambahan dari yang ngajak: "${pesanTambahan}".` : '';

  const prompt: AiMessage[] = [{
    role: 'user',
    parts: [{ text: `Tugas lu adalah jadi perantara buat ngajakin orang mabar${promptGame}. Target yang diajak: ${mentions}.${promptTambahan} Buat satu kalimat ajakan santai ala anak tongkrongan yang ngegas dikit biar pada mau join. Lu posisinya mewakili si pengajak (${interaction.user.displayName}). Jangan kaku.` }]
  }];

  const ajakan = await askAI(prompt) || 'woi login ga lo pada, mabar buruan.';
  const channel = interaction.channel as TextChannel;
  await channel.send(`${mentions} ${splitLong(ajakan)[0]}`);
  await interaction.followUp({ content: `Beres, udah gua panggilin ${mentions}.`, ephemeral: true });
}


