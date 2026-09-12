import { ChatInputCommandInteraction, SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, Colors, Message } from 'discord.js';
import { logger } from '@hamin/utils';

export default {
  name: 'daftarban',
  description: 'Melihat daftar member yang sedang diban',
  data: new SlashCommandBuilder()
    .setName('daftarban')
    .setDescription('Lihat daftar member yang diban')
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

  executeSlash: async (interaction: ChatInputCommandInteraction) => {
    await interaction.deferReply({ ephemeral: true });

    try {
      if (!interaction.guild) {
        await interaction.followUp('Command ini cuma bisa dipakai di dalam server.');
        return;
      }

      const bans = await interaction.guild.bans.fetch();

      if (bans.size === 0) {
        await interaction.followUp('Ga ada member yang lagi diban saat ini.');
        return;
      }

      // Ambil 20 ban terakhir/pertama buat ditampilkan biar ga numpuk
      const banList = Array.from(bans.values()).slice(0, 20);
      
      const baris = banList.map((ban, index) => {
        const alasan = ban.reason ? ban.reason : 'Tidak ada alasan';
        return `**${index + 1}. ${ban.user.tag}** (\`${ban.user.id}\`)\n└ Alasan: ${alasan}`;
      });

      const embed = new EmbedBuilder()
        .setTitle(`Daftar Ban (Total: ${bans.size})`)
        .setDescription(baris.join('\n\n'))
        .setColor(Colors.DarkRed)
        .setFooter({ text: bans.size > 20 ? 'Menampilkan 20 data teratas.' : 'Menampilkan semua data ban.' });

      await interaction.followUp({ embeds: [embed] });

    } catch (error) {
      logger.error(error, '[daftarban] Gagal fetch data ban');
      await interaction.followUp('Gagal mengambil daftar ban. Pastikan bot punya izin untuk melihat daftar ban.');
    }
  },

  executePrefix: async (message: Message, args: string[]) => {
    await message.reply('Gunakan command slash `/daftarban` untuk melihat daftar ban.');
  }
};
