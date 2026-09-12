import { ChatInputCommandInteraction, SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, Message } from 'discord.js';

export default {
  name: 'panelverifikasi',
  description: 'Membuat panel verifikasi dengan tombol (Admin Only)',
  data: new SlashCommandBuilder()
    .setName('panelverifikasi')
    .setDescription('Membuat panel verifikasi dengan tombol (Admin Only)')
    .addRoleOption(option => 
      option.setName('role')
        .setDescription('Role yang akan diberikan setelah verifikasi')
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName('deskripsi')
        .setDescription('Pesan/deskripsi untuk panel verifikasi')
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  executeSlash: async (interaction: ChatInputCommandInteraction) => {
    const role = interaction.options.getRole('role', true);
    const description = interaction.options.getString('deskripsi') || 'Klik tombol di bawah ini untuk memverifikasi diri Anda dan mendapatkan akses ke server.';

    const embed = new EmbedBuilder()
      .setTitle('✅ Verifikasi Member')
      .setDescription(description)
      .setColor(0x00FF00);

    const button = new ButtonBuilder()
      .setCustomId(`verify_button:${role.id}`)
      .setLabel('Verifikasi Saya')
      .setStyle(ButtonStyle.Success)
      .setEmoji('✅');

    const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(button);

    const channel = interaction.channel as import('discord.js').TextChannel;
    if (channel) {
      await channel.send({ embeds: [embed], components: [actionRow] });
    }
    await interaction.reply({ content: 'Panel verifikasi berhasil dibuat!', ephemeral: true });
  },

  executePrefix: async (message: Message, args: string[]) => {
    if (!message.member?.permissions.has(PermissionFlagsBits.Administrator)) {
      await message.reply('Anda tidak memiliki izin untuk menggunakan perintah ini.');
      return;
    }
    
    // Prefix command fallback - expecting role ID as argument
    const roleId = args[0]?.replace(/\D/g, '');
    if (!roleId) {
      await message.reply('Harap sebutkan role atau ID role. Contoh: `!panelverifikasi @Verified`');
      return;
    }

    const role = message.guild?.roles.cache.get(roleId);
    if (!role) {
      await message.reply('Role tidak ditemukan.');
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle('✅ Verifikasi Member')
      .setDescription('Klik tombol di bawah ini untuk memverifikasi diri Anda dan mendapatkan akses ke server.')
      .setColor(0x00FF00);

    const button = new ButtonBuilder()
      .setCustomId(`verify_button:${role.id}`)
      .setLabel('Verifikasi Saya')
      .setStyle(ButtonStyle.Success)
      .setEmoji('✅');

    const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(button);

    const channel = message.channel as import('discord.js').TextChannel;
    await channel.send({ embeds: [embed], components: [actionRow] });
    await message.reply('Panel verifikasi berhasil dibuat!');
  }
};
