import { ChatInputCommandInteraction, SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import prisma from '../prisma';

export const data = new SlashCommandBuilder()
  .setName('hapuslink')
  .setDescription('Hapus link dari daftar')
  .addIntegerOption(o => o.setName('nomor').setDescription('Nomor link yang mau dihapus').setRequired(true))
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages);

export async function executeSlash(interaction: ChatInputCommandInteraction) {
  const nomor = interaction.options.getInteger('nomor', true);

  const existing = await prisma.resource.findUnique({ where: { id: nomor } });
  if (!existing) {
    await interaction.reply({ content: `Nomor #${nomor} ga ketemu.`, ephemeral: true });
    return;
  }

  await prisma.resource.delete({ where: { id: nomor } });
  await interaction.reply({ content: `Link #${nomor} udah dihapus.`, ephemeral: true });
}
