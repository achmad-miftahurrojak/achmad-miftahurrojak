import { ChatInputCommandInteraction, SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, Message } from 'discord.js';

export default {
  name: 'panelrole',
  description: 'Membuat pesan panel dengan tombol untuk mengambil role (Admin Only)',
  data: new SlashCommandBuilder()
    .setName('panelrole')
    .setDescription('Bikin panel role, member tinggal klik tombol')
    .addStringOption(option =>
      option.setName('judul')
        .setDescription('Judul panelnya')
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName('pilihan')
        .setDescription('Format: emoji=NamaRole, dipisah koma. Contoh: 🎮=Gamers, 🔔=Notif')
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName('isi')
        .setDescription('Tulisan penjelasannya')
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  executeSlash: async (interaction: ChatInputCommandInteraction) => {
    const judul = interaction.options.getString('judul', true);
    const pilihan = interaction.options.getString('pilihan', true);
    const isi = interaction.options.getString('isi') || 'Pencet tombol di bawah buat ambil rolenya. Pencet lagi buat ngelepas.';

    const peta: { emoji: string, roleName: string }[] = [];
    const salah: string[] = [];
    const gaAda: string[] = [];

    const parts = pilihan.split(',');
    for (let bagian of parts) {
      bagian = bagian.trim();
      if (!bagian) continue;
      
      const idx = bagian.indexOf('=');
      if (idx === -1) {
        salah.push(bagian);
        continue;
      }
      
      const emoji = bagian.substring(0, idx).trim();
      const roleName = bagian.substring(idx + 1).trim();
      
      if (!emoji || !roleName) {
        salah.push(bagian);
        continue;
      }
      
      const role = interaction.guild?.roles.cache.find(r => r.name === roleName);
      if (!role) {
        gaAda.push(roleName);
        continue;
      }
      
      peta.push({ emoji, roleName: role.name });
    }

    if (salah.length > 0) {
      await interaction.reply({ 
        content: `Formatnya salah di: ${salah.map(x => `\`${x}\``).join(', ')}\nHarusnya \`emoji=NamaRole\`, dipisah koma.`, 
        ephemeral: true 
      });
      return;
    }

    if (gaAda.length > 0) {
      await interaction.reply({ 
        content: `Role ini belum ada di server: ${gaAda.map(x => `\`${x}\``).join(', ')}\nBikin dulu rolenya, ditulis persis sama.`, 
        ephemeral: true 
      });
      return;
    }

    if (peta.length === 0) {
      await interaction.reply({ content: 'Ga ada pilihan yang kebaca.', ephemeral: true });
      return;
    }

    if (peta.length > 5) {
      await interaction.reply({ content: 'Maksimal 5 pilihan role dalam satu panel.', ephemeral: true });
      return;
    }

    const baris = peta.map(p => `${p.emoji} — **${p.roleName}**`).join('\n');
    const embed = new EmbedBuilder()
      .setTitle(judul)
      .setDescription(`${isi}\n\n${baris}`)
      .setColor(0x5865F2); // Blurple

    const row = new ActionRowBuilder<ButtonBuilder>();
    
    for (const p of peta) {
      const role = interaction.guild?.roles.cache.find(r => r.name === p.roleName);
      if (!role) continue;
      
      const button = new ButtonBuilder()
        .setCustomId(`panelrole:${role.id}`)
        .setLabel(p.roleName)
        .setStyle(ButtonStyle.Secondary)
        .setEmoji(p.emoji);
        
      row.addComponents(button);
    }

    const channel = interaction.channel as import('discord.js').TextChannel;
    if (channel) {
      await channel.send({ embeds: [embed], components: [row] });
    }
    
    await interaction.reply({ 
      content: `Panel jadi, ${peta.length} pilihan kepasang.\nPosisi role bot harus di atas role yang dibagiin.`, 
      ephemeral: true 
    });
  },

  executePrefix: async (message: Message, args: string[]) => {
    // Prefix execution not strictly required as slash is primary for complex inputs
    await message.reply('Gunakan command slash `/panelrole` untuk membuat panel role.');
  }
};
