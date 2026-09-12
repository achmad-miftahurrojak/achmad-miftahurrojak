import { ChatInputCommandInteraction, SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import prisma from '../prisma';
const KATEGORI = ['Beasiswa', 'Lowongan', 'Kuliah', 'Tutorial', 'Lainnya'];

export const data = new SlashCommandBuilder()
  .setName('editlink')
  .setDescription('Edit data link yang sudah disimpen')
  .addIntegerOption(o => o.setName('nomor').setDescription('Nomor link').setRequired(true))
  .addStringOption(o => o.setName('judul').setDescription('Judul baru (opsional)').setRequired(false))
  .addStringOption(o => o.setName('link').setDescription('Link baru (opsional)').setRequired(false))
  .addStringOption(o => o.setName('catatan').setDescription('Catatan baru (opsional)').setRequired(false))
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages);

export async function executeSlash(interaction: ChatInputCommandInteraction) {
  const nomor = interaction.options.getInteger('nomor', true);
  const judul = interaction.options.getString('judul');
  const link = interaction.options.getString('link');
  const catatan = interaction.options.getString('catatan');

  if (!judul && !link && !catatan) {
    await interaction.reply({ content: 'Isi minimal satu field yang mau diubah.', ephemeral: true });
    return;
  }

  const existing = await prisma.resource.findUnique({ where: { id: nomor } });
  if (!existing) {
    await interaction.reply({ content: `Nomor #${nomor} ga ketemu.`, ephemeral: true });
    return;
  }

  if (link && !link.startsWith('http')) {
    await interaction.reply({ content: 'Linknya harus diawali http atau https.', ephemeral: true });
    return;
  }

  await prisma.resource.update({
    where: { id: nomor },
    data: {
      ...(judul && { judul }),
      ...(link && { link }),
      ...(catatan !== null && catatan !== undefined && { catatan }),
    },
  });

  await interaction.reply({ content: `Link #${nomor} udah diupdate.`, ephemeral: true });
}
