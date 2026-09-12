import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder, Colors } from 'discord.js';
import * as fs from 'fs';
import * as path from 'path';
import { logger } from '@hamin/utils';


export const data = new SlashCommandBuilder()
  .setName('undanganku')
  .setDescription('Cek berapa banyak member yang udah join lewat invite link lu');

export async function executeSlash(interaction: ChatInputCommandInteraction) {
  const guildId = interaction.guildId;
  if (!guildId) return;

  const undanganPath = path.join(process.cwd(), '../../data/undangan.json');
  let total = 0;

  try {
    if (fs.existsSync(undanganPath)) {
      const fileData = fs.readFileSync(undanganPath, 'utf8');
      const data = JSON.parse(fileData);
      
      const guildData = data[guildId] || {};
      const userData = guildData[interaction.user.id] || {};
      total = userData.total || 0;
    }
  } catch (err) {
    logger.error(err, '[undanganku] gagal baca undangan.json');
  }

  const embed = new EmbedBuilder()
    .setTitle('📨  Catatan Undangan')
    .setDescription(`Lo udah berhasil ngajak **${total} orang** gabung ke server ini.`)
    .setColor(Colors.Green);

  if (total > 0) {
    embed.setFooter({ text: 'Makasih udah bantu ramein server!' });
  }

  await interaction.reply({ embeds: [embed] });
}

export async function executePrefix() {
  // Not implemented for prefix
}
