import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder, Message } from 'discord.js';
import { logger } from '@hamin/utils';

interface HariLibur {
  holiday_date: string;
  holiday_name: string;
  is_national_holiday: boolean;
}

export default {
  name: 'ceklibur',
  description: 'Cek hari libur nasional terdekat',
  data: new SlashCommandBuilder()
    .setName('ceklibur')
    .setDescription('Cek hari besar/libur nasional terdekat'),

  executeSlash: async (interaction: ChatInputCommandInteraction) => {
    await interaction.deferReply();

    try {
      const year = new Date().getFullYear();
      const response = await fetch(`https://api-hari-libur.vercel.app/api?year=${year}`);
      
      if (!response.ok) {
        throw new Error(`API returned status ${response.status}`);
      }

      const data: HariLibur[] = await response.json();
      
      if (!Array.isArray(data)) {
        throw new Error('API format unexpected');
      }

      // Filter only upcoming holidays
      const now = new Date();
      // Reset time to start of day for fair comparison
      now.setHours(0, 0, 0, 0);

      const upcoming = data
        .map(h => ({
          dateStr: h.holiday_date,
          dateObj: new Date(h.holiday_date),
          name: h.holiday_name,
          isLibur: h.is_national_holiday
        }))
        .filter(h => h.dateObj >= now)
        .sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime())
        .slice(0, 5); // Take top 5

      if (upcoming.length === 0) {
        await interaction.followUp('Ga ada data libur/hari besar lagi untuk tahun ini.');
        return;
      }

      const baris = upcoming.map(h => {
        const selisih = Math.ceil((h.dateObj.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        const kapan = selisih === 0 ? 'hari ini' : `${selisih} hari lagi`;
        const marker = h.isLibur ? '🔴' : '⚪';
        return `${marker} **${h.name}**\n${h.dateStr} (${kapan})`;
      });

      const embed = new EmbedBuilder()
        .setTitle('🗓️ Hari besar / Libur terdekat')
        .setDescription(baris.join('\n\n'))
        .setColor(0x0099FF)
        .setFooter({ text: '🔴 Libur Nasional · ⚪ Peringatan Biasa' });

      await interaction.followUp({ embeds: [embed] });
    } catch (error) {
      logger.error(error, '[ceklibur] Gagal fetch data libur');
      await interaction.followUp('Gagal mengambil data libur. Coba lagi nanti ya.');
    }
  },

  executePrefix: async (message: Message, args: string[]) => {
    await message.reply('Gunakan command slash `/ceklibur` untuk ngecek libur.');
  }
};
