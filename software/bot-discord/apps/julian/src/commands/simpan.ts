import { ChatInputCommandInteraction, SlashCommandBuilder, TextChannel, EmbedBuilder, Colors } from 'discord.js';
import prisma from '../prisma';
import { logger } from '@hamin/utils';

const CHANNEL_RESOURCES_ID = process.env.JULIAN_CHANNEL_RESOURCES_ID || '1532241897265828122';
const KATEGORI = ['Beasiswa', 'Lowongan', 'Kuliah', 'Tutorial', 'Lainnya'];

export const data = new SlashCommandBuilder()
  .setName('simpan')
  .setDescription('Simpan link biar ga tenggelam di chat')
  .addStringOption(o => o.setName('judul').setDescription('Judulnya apa').setRequired(true))
  .addStringOption(o => o.setName('link').setDescription('Alamat webnya').setRequired(true))
  .addStringOption(o =>
    o.setName('kategori').setDescription('Masuk kategori mana').setRequired(true)
      .addChoices(...KATEGORI.map(k => ({ name: k, value: k })))
  )
  .addStringOption(o => o.setName('catatan').setDescription('Keterangan tambahan (opsional)').setRequired(false));

export async function executeSlash(interaction: ChatInputCommandInteraction) {
  const judul = interaction.options.getString('judul', true);
  const link = interaction.options.getString('link', true);
  const kategori = interaction.options.getString('kategori', true);
  const catatan = interaction.options.getString('catatan') ?? '';

  if (!link.startsWith('http')) {
    await interaction.reply({ content: 'Linknya harus diawali http atau https.', ephemeral: true });
    return;
  }

  // Check for duplicate
  const existing = await prisma.resource.findFirst({ where: { link } });
  if (existing) {
    await interaction.reply({ content: 'Link itu udah pernah disimpen.', ephemeral: true });
    return;
  }

  const saved = await prisma.resource.create({
    data: {
      judul,
      link,
      kategori,
      catatan,
      oleh: interaction.user.displayName,
    },
  });

  const embed = new EmbedBuilder()
    .setTitle(judul)
    .setURL(link)
    .setDescription(catatan || null)
    .setColor(0x1ABC9C)
    .addFields(
      { name: 'Kategori', value: kategori, inline: true },
      { name: 'Nomor', value: `#${saved.id}`, inline: true }
    )
    .setFooter({ text: `Disimpen ${saved.oleh} • cari lagi pakai /cari` });

  const targetChannel = interaction.guild?.channels.cache.get(CHANNEL_RESOURCES_ID) as TextChannel | undefined;
  if (targetChannel) {
    await targetChannel.send({ embeds: [embed] });
    await interaction.reply({ content: `Kesimpen dan diposting ke ${targetChannel.toString()}.`, ephemeral: true });
  } else {
    await interaction.reply({ embeds: [embed] });
  }
}
