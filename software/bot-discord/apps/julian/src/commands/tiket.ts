import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  Colors,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  ThreadChannel,
  GuildMember,
} from 'discord.js';
import prisma from '../prisma';
import { logger } from '@hamin/utils';

const LOG_CHANNEL_ID = process.env.LOG_CHANNEL_ID || '';
const ROLE_PENJAGA_TIKET = process.env.JULIAN_ROLE_PENJAGA_TIKET || 'Island Owner';
const TIKET_MAKS_PER_ORANG = 2;

// ─── /paneltiket ─────────────────────────────────────────────────────────────

export const paneltiketData = new SlashCommandBuilder()
  .setName('paneltiket')
  .setDescription('Pasang panel tiket di channel ini')
  .addStringOption(o => o.setName('judul').setDescription('Judul panelnya').setRequired(false))
  .addStringOption(o => o.setName('isi').setDescription('Tulisan penjelasannya').setRequired(false))
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

export async function paneltiketSlash(interaction: ChatInputCommandInteraction) {
  const judul = interaction.options.getString('judul') ?? 'Butuh bantuan?';
  const isi = interaction.options.getString('isi') ?? 'Pencet tombol di bawah buat ngobrol berdua sama moderator. Ga ada yang lain yang bisa baca.';

  const embed = new EmbedBuilder()
    .setTitle(judul)
    .setDescription(isi)
    .setColor(Colors.Blurple);

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('julian:buka_tiket')
      .setLabel('Buka Tiket')
      .setEmoji('🎫')
      .setStyle(ButtonStyle.Primary)
  );

  await interaction.reply({ content: 'Panel tiketnya gua pasang.', ephemeral: true });
  await (interaction.channel as any).send({ embeds: [embed], components: [row] });
}

// ─── /tiket ──────────────────────────────────────────────────────────────────

export const tiketData = new SlashCommandBuilder()
  .setName('tiket')
  .setDescription('Urus tiket yang lagi kebuka')
  .addStringOption(o =>
    o.setName('aksi').setDescription('Mau ngapain').setRequired(true)
      .addChoices({ name: 'tutup', value: 'tutup' })
  );

export async function tiketSlash(interaction: ChatInputCommandInteraction) {
  const thread = interaction.channel as ThreadChannel;
  const ticket = await prisma.ticket.findUnique({ where: { channelId: thread.id } });

  if (!ticket || ticket.status !== 'OPEN') {
    await interaction.reply({ content: 'Perintah ini cuma jalan di dalam tiket yang masih terbuka.', ephemeral: true });
    return;
  }

  const member = interaction.member as GuildMember;
  const canClose = interaction.user.id === ticket.userId || member.permissions.has(PermissionFlagsBits.ManageThreads);

  if (!canClose) {
    await interaction.reply({ content: 'Cuma yang buka tiket atau moderator yang bisa nutup.', ephemeral: true });
    return;
  }

  await prisma.ticket.update({
    where: { channelId: thread.id },
    data: { status: 'CLOSED' },
  });

  await interaction.reply({ content: `Tiket ditutup sama ${interaction.user}. Transkripnya gua kirim ke moderator.` });

  // Build transcript
  const berkas = await rakitTranskrip(thread, ticket.userId, ticket.createdAt.toISOString());

  try {
    await thread.edit({ archived: true, locked: true, reason: `Ditutup ${interaction.user.tag}` });
  } catch { /* ignore */ }

  await kirimTranskrip(interaction, thread.name, berkas);
}

async function rakitTranskrip(thread: ThreadChannel, bukaOlehId: string, dibukaTs: string): Promise<Buffer> {
  const baris: string[] = [
    `Transkrip tiket: ${thread.name}`,
    `ID thread : ${thread.id}`,
    `Dibuka oleh : <@${bukaOlehId}>`,
    `Dibuka    : ${dibukaTs}`,
    '='.repeat(60),
    '',
  ];

  try {
    const messages = await thread.messages.fetch({ limit: 100 });
    const sorted = [...messages.values()].sort((a, b) => a.createdTimestamp - b.createdTimestamp);

    for (const msg of sorted) {
      const waktu = msg.createdAt.toLocaleString('id-ID');
      let isi = msg.content || '';
      for (const lampiran of msg.attachments.values()) {
        isi += `\n    [lampiran] ${lampiran.name} — ${lampiran.url}`;
      }
      for (const embed of msg.embeds) {
        isi += `\n    [embed] ${embed.title || ''} ${embed.description || ''}`;
      }
      baris.push(`[${waktu}] ${msg.author.displayName}: ${isi}`);
    }

    baris.push('', `Total ${sorted.length} pesan.`);
  } catch {
    baris.push('(ga bisa baca isi thread, bot kurang izin)');
  }

  return Buffer.from(baris.join('\n'), 'utf-8');
}

async function kirimTranskrip(interaction: ChatInputCommandInteraction, threadName: string, berkas: Buffer) {
  if (!LOG_CHANNEL_ID) return;
  const logChannel = interaction.guild?.channels.cache.get(LOG_CHANNEL_ID);
  if (!logChannel?.isTextBased()) return;

  const embed = new EmbedBuilder()
    .setTitle('Tiket ditutup')
    .setDescription(`**${threadName}** ditutup ${interaction.user}\nTranskrip terlampir.`)
    .setColor(Colors.Greyple)
    .setTimestamp();

  try {
    await (logChannel as any).send({
      embeds: [embed],
      files: [{ attachment: berkas, name: `tiket-${Date.now()}.txt` }]
    });
  } catch {
    logger.warn('[tiket] ga punya izin kirim transkrip ke log');
  }
}

// ─── Button handler (buka tiket) ─────────────────────────────────────────────

export async function handleTiketButton(interaction: any) {
  if (interaction.customId !== 'julian:buka_tiket') return false;

  const guild = interaction.guild;
  const member = interaction.member as GuildMember;

  const openTickets = await prisma.ticket.findMany({
    where: { userId: member.id, status: 'OPEN' }
  });

  if (openTickets.length >= TIKET_MAKS_PER_ORANG) {
    await interaction.reply({
      content: `Lo udah punya ${openTickets.length} tiket yang belum ditutup. Selesaiin dulu yang itu.`,
      ephemeral: true
    });
    return true;
  }

  await interaction.deferReply({ ephemeral: true });

  const nama = `tiket-${member.displayName}`.slice(0, 95);

  try {
    const thread = await interaction.channel.threads.create({
      name: nama,
      type: 12, // PrivateThread
      invitable: false,
      reason: `Tiket dari ${member.user.tag}`,
    });

    await thread.members.add(member.id);

    await prisma.ticket.create({
      data: {
        channelId: thread.id,
        userId: member.id,
        status: 'OPEN',
      }
    });

    const penjaga = guild.roles.cache.find((r: any) => r.name === ROLE_PENJAGA_TIKET);
    let sapaan = `${member} ceritain aja di sini, ada apa. Yang bisa baca cuma lo sama moderator.\nKalau udah kelar, ketik \`/tiket tutup\`.`;
    if (penjaga) sapaan += `\n\n${penjaga} ada tiket baru.`;

    await thread.send(sapaan);
    await interaction.followUp({ content: `Tiket lo kebuka di ${thread}.`, ephemeral: true });

    if (LOG_CHANNEL_ID) {
      const logChannel = guild.channels.cache.get(LOG_CHANNEL_ID);
      if (logChannel?.isTextBased()) {
        await (logChannel as any).send({ content: `🎫 ${member} buka tiket di ${thread}` }).catch(() => {});
      }
    }
  } catch (err) {
    logger.error(err, '[tiket] gagal bikin thread');
    await interaction.followUp({ content: 'Gagal bikin tiket. Bot butuh izin Create Private Threads di channel ini.', ephemeral: true });
  }

  return true;
}
