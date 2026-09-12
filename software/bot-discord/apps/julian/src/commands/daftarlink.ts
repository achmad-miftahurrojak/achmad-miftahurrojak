import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder, Colors } from 'discord.js';
import prisma from '../prisma';
const KATEGORI = ['Beasiswa', 'Lowongan', 'Kuliah', 'Tutorial', 'Lainnya'];

export const data = new SlashCommandBuilder()
  .setName('daftarlink')
  .setDescription('Liat semua link per kategori')
  .addStringOption(o =>
    o.setName('kategori').setDescription('Mau liat kategori apa').setRequired(true)
      .addChoices(...KATEGORI.map(k => ({ name: k, value: k })))
  );

export async function executeSlash(interaction: ChatInputCommandInteraction) {
  const kategori = interaction.options.getString('kategori', true);
  const hasil = await prisma.resource.findMany({ where: { kategori }, orderBy: { id: 'desc' }, take: 15 });

  if (!hasil.length) {
    await interaction.reply({ content: `Belum ada yang disimpen di kategori ${kategori}.`, ephemeral: true });
    return;
  }

  const baris = hasil.map(d => `**#${d.id}** [${d.judul}](${d.link}) • ${d.oleh}`);
  const embed = new EmbedBuilder()
    .setTitle(`Kategori ${kategori}`)
    .setDescription(baris.join('\n'))
    .setColor(0x1ABC9C)
    .setFooter({ text: `Total ${hasil.length} link` });

  await interaction.reply({ embeds: [embed] });
}
