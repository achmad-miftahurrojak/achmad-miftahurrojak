import { Client, GatewayIntentBits, EmbedBuilder, Colors, TextChannel, ActivityType, AttachmentBuilder } from 'discord.js';
import { createCanvas, loadImage, GlobalFonts, Image } from '@napi-rs/canvas';
import { CHANNELS, commandChannelMessage, isCommandAllowed, logger } from '@hamin/utils';
import { createEvent, publishEvent } from '@hamin/database';
import * as path from 'path';
import { loadCommands, commands, registerSlashCommands } from './handler';
import { processAutomod, startAutomodTasks } from './modules/automod';
import { handleVoiceStateUpdate, startVoiceActivityLoop, updateVoiceActivity } from './modules/voice';
import { handleStarboard } from './modules/starboard';
import { initInviteCache, findInviter, refreshInvites, recordInvite } from './modules/inviteTracker';
import { handleTiketButton } from './commands/tiket';
import { startNewsLoop } from './modules/news';
import { deteksiRaid, tanganiRaid, deteksiNuke, tanganiNuke } from './modules/lockdown';
import { cekTempban } from './commands/tempban';
import { contextMenus, getContextMenuData } from './context';
import prisma from './prisma';
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildInvites,
    GatewayIntentBits.GuildMessageReactions,
  ],
  partials: ['MESSAGE' as any, 'CHANNEL' as any, 'REACTION' as any],
});

const CHANNEL_RULES = {
  ping: [CHANNELS.general], serverinfo: [CHANNELS.general], userinfo: [CHANNELS.general],
  warn: [CHANNELS.moderator], warnings: [CHANNELS.moderator], clearwarns: [CHANNELS.moderator],
  ban: [CHANNELS.moderator], kick: [CHANNELS.moderator], timeout: [CHANNELS.moderator],
  purge: [CHANNELS.moderator], automod: [CHANNELS.moderator], kunci: [CHANNELS.moderator],
  buka: [CHANNELS.moderator], say: [CHANNELS.moderator], embed: [CHANNELS.moderator],
  panelverifikasi: [CHANNELS.rules], paneltiket: [CHANNELS.moderator], tiket: [CHANNELS.moderator],
  simpan: [CHANNELS.resources], cari: [CHANNELS.resources], daftarlink: [CHANNELS.resources],
  editlink: [CHANNELS.resources], hapuslink: [CHANNELS.resources], poll: [CHANNELS.general]
} as const;

const STATUS_LIST = [
  'jaga ketertiban server 🛡️',
  'kalau rusuh langsung gua tangani',
  'baca rules dulu ya sebelum nanya',
  'gua pantau dari pojokan 👀',
  'moderasi berjalan, santai aja',
  'ga ada yang lolos dari radar gua'
];

client.once('ready', async () => {
  logger.info(`[julian] ${client.user?.tag} online`);
  await loadCommands(path.join(__dirname, 'commands'));
  if (client.user && process.env.JULIAN_TOKEN) {
    await registerSlashCommands(client.user.id, process.env.JULIAN_TOKEN, getContextMenuData());
  }
  startAutomodTasks(client);
  initInviteCache(client);
  startNewsLoop(client);
  startVoiceActivityLoop(client);

  // Warn expiry cleanup every 6 hours
  setInterval(async () => {
    try {
      const { count } = await prisma.warn.deleteMany({
        where: { expiresAt: { lte: new Date() } }
      });
      if (count > 0) logger.info(`[julian] ${count} warn expired dibersihkan`);
    } catch (e) {
      logger.error(e, '[julian] warn cleanup gagal');
    }
  }, 6 * 60 * 60 * 1000);

  // Rotating status
  let statusIdx = 0;
  setInterval(() => {
    client.user?.setActivity({ name: STATUS_LIST[statusIdx % STATUS_LIST.length], type: ActivityType.Custom });
    statusIdx++;
  }, 12_000);

  // Cek tempban yang sudah expired saat bot nyala
  cekTempban(client);

  // Cek member yang sudah ada di voice saat bot nyala
  client.guilds.cache.forEach(guild => {
    guild.channels.cache.filter(ch => ch.isVoiceBased()).forEach(ch => {
      ch.members.forEach(member => {
        if (!member.user.bot && member.voice) {
          handleVoiceStateUpdate(client, member.voice, member.voice);
        }
      });
    });
  });
});

// ── Pesan masuk (automod + prefix) ────────────────────────────────────────────
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  await processAutomod(message);

  const prefix = '!';
  if (!message.content.startsWith(prefix)) return;

  const args = message.content.slice(prefix.length).trim().split(/ +/);
  const commandName = args.shift()?.toLowerCase();

  if (!commandName) return;

  const command = commands.get(commandName);
  if (!command || !command.executePrefix) return;

  if (!isCommandAllowed(commandName, message.channelId, CHANNEL_RULES)) {
    await message.reply(commandChannelMessage(commandName, CHANNEL_RULES));
    return;
  }

  try {
    await command.executePrefix(message, args);
  } catch (error) {
    logger.error(error, `Error executing command ${commandName}`);
    message.reply('Ada yang error waktu jalanin command itu 😅');
  }
});

// ── Interaction (slash command + button) ──────────────────────────────────────
client.on('interactionCreate', async (interaction) => {
  // ── Button ────────────────────────────────────────────────────────────────
  if (interaction.isButton()) {
    // Tiket button
    const handled = await handleTiketButton(interaction).catch(() => false);
    if (handled) return;

    // Verify button (dari /panelverifikasi)
    const [action, ...bArgs] = interaction.customId.split(':');
    if (action === 'verify_button') {
      const roleId = bArgs[0];
      if (!roleId) {
        await interaction.reply({ content: 'Error: konfigurasi tombol ga valid (Role ID hilang).', ephemeral: true });
        return;
      }

      const role = interaction.guild?.roles.cache.get(roleId);
      if (!role) {
        await interaction.reply({ content: 'Error: role verifikasi udah ga ada di server ini.', ephemeral: true });
        return;
      }

      const member = await interaction.guild?.members.fetch(interaction.user.id);
      if (!member) {
        await interaction.reply({ content: 'Error: ga bisa nemuin data member lo.', ephemeral: true });
        return;
      }

      if (member.roles.cache.has(roleId)) {
        await interaction.reply({ content: 'Lo udah terverifikasi sebelumnya! 👍', ephemeral: true });
        return;
      }

      try {
        await member.roles.add(role);
        await interaction.reply({ content: `Verifikasi berhasil! Role **${role.name}** udah dikasih ke lo. Welcome! 🎉`, ephemeral: true });
      } catch (error) {
        logger.error(error, `[julian] gagal kasih role ${roleId} ke ${interaction.user.id}`);
        await interaction.reply({ content: 'Gagal verifikasi. Pastiin posisi role bot di atas role yang mau dikasih ya.', ephemeral: true });
      }
    }
    
    // Panel Role button (dari /panelrole)
    if (action === 'panelrole') {
      const roleId = bArgs[0];
      if (!roleId) {
        await interaction.reply({ content: 'Error: konfigurasi tombol ga valid.', ephemeral: true });
        return;
      }

      const role = interaction.guild?.roles.cache.get(roleId);
      if (!role) {
        await interaction.reply({ content: 'Error: role udah ga ada di server.', ephemeral: true });
        return;
      }

      const member = await interaction.guild?.members.fetch(interaction.user.id);
      if (!member) {
        await interaction.reply({ content: 'Error: ga bisa nemuin data lo.', ephemeral: true });
        return;
      }

      try {
        if (member.roles.cache.has(roleId)) {
          await member.roles.remove(role);
          await interaction.reply({ content: `Role **${role.name}** berhasil dilepas dari lo.`, ephemeral: true });
        } else {
          await member.roles.add(role);
          await interaction.reply({ content: `Role **${role.name}** berhasil dipasang ke lo.`, ephemeral: true });
        }
      } catch (error) {
        logger.error(error, `[julian] gagal atur role ${roleId} ke ${interaction.user.id}`);
        await interaction.reply({ content: 'Gagal ngatur role. Pastiin posisi role bot di atas role yang mau dikasih ya.', ephemeral: true });
      }
    }
    return;
  }

  // ── Context menu ──────────────────────────────────────────────────────────
  if (interaction.isUserContextMenuCommand()) {
    const ctxCmd = contextMenus.get(interaction.commandName);
    if (ctxCmd) {
      await ctxCmd.execute(interaction).catch(e => logger.error(e, `[context] ${interaction.commandName}`));
    }
    return;
  }

  if (interaction.isMessageContextMenuCommand()) {
    const ctxCmd = contextMenus.get(interaction.commandName);
    if (ctxCmd) {
      await ctxCmd.execute(interaction).catch(e => logger.error(e, `[context] ${interaction.commandName}`));
    }
    return;
  }

  // ── Slash command ──────────────────────────────────────────────────────────
  if (!interaction.isChatInputCommand()) return;

  const command = commands.get(interaction.commandName);
  if (!command || !command.executeSlash) return;

  try {
    if (!isCommandAllowed(interaction.commandName, interaction.channelId, CHANNEL_RULES)) {
      await interaction.reply({ content: commandChannelMessage(interaction.commandName, CHANNEL_RULES), ephemeral: true });
      return;
    }
    await command.executeSlash(interaction);
  } catch (error) {
    logger.error(error, `Error executing slash command ${interaction.commandName}`);
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ content: 'Ada yang error waktu jalanin command itu 😅', ephemeral: true });
    } else {
      await interaction.reply({ content: 'Ada yang error waktu jalanin command itu 😅', ephemeral: true });
    }
  }
});

// ── Log pesan dihapus ─────────────────────────────────────────────────────────
client.on('messageDelete', async (message) => {
  if (message.author?.bot || !message.guild) return;

  const logChannelId = process.env.LOG_CHANNEL_ID || CHANNELS.logServer;
  if (!logChannelId) return;

  const channel = message.guild.channels.cache.get(logChannelId) as TextChannel;
  if (!channel) return;

  const content = message.content ? message.content.substring(0, 500) : '(kosong atau cuma lampiran)';
  const embed = new EmbedBuilder()
    .setTitle('🗑️ Pesan dihapus')
    .setColor(Colors.Red)
    .setDescription(`Dari ${message.author} di ${message.channel}\n\n${content}`)
    .setTimestamp();

  try {
    await channel.send({ embeds: [embed] });
  } catch (error) {
    logger.error(error, '[julian] gagal kirim log messageDelete');
  }
});

// ── Log pesan diedit ──────────────────────────────────────────────────────────
client.on('messageUpdate', async (oldMessage, newMessage) => {
  if (oldMessage.author?.bot || !oldMessage.guild) return;
  if (oldMessage.content === newMessage.content) return;

  const logChannelId = process.env.LOG_CHANNEL_ID || CHANNELS.logServer;
  if (!logChannelId) return;

  const channel = oldMessage.guild.channels.cache.get(logChannelId) as TextChannel;
  if (!channel) return;

  const oldContent = oldMessage.content ? oldMessage.content.substring(0, 300) : '(kosong)';
  const newContent = newMessage.content ? newMessage.content.substring(0, 300) : '(kosong)';

  const embed = new EmbedBuilder()
    .setTitle('✏️ Pesan diedit')
    .setColor(Colors.Blue)
    .setDescription(`Dari ${oldMessage.author} di ${oldMessage.channel}\n\n**Sebelum:** ${oldContent}\n**Sesudah:** ${newContent}`)
    .setTimestamp();

  try {
    await channel.send({ embeds: [embed] });
  } catch (error) {
    logger.error(error, '[julian] gagal kirim log messageUpdate');
  }
});

// ── Voice state ───────────────────────────────────────────────────────────────
client.on('voiceStateUpdate', (oldState, newState) => {
  handleVoiceStateUpdate(client, oldState, newState);
  // Update embed voice activity di #general
  updateVoiceActivity(client).catch(() => {});
});

// ── Anti-nuke: mass ban ───────────────────────────────────────────────────────
client.on('guildBanAdd', async (ban) => {
  if (!ban.user) return;
  if (deteksiNuke(`ban:${ban.user.id}`)) {
    await tanganiNuke(ban.guild, client, 'ban');
  }
});

// ── Anti-nuke: channel deleted ───────────────────────────────────────────────
client.on('channelDelete', async (ch) => {
  if (!('guild' in ch) || !ch.guild) return;
  const guild = ch.guild;
  if (deteksiNuke(`channel:${ch.id}`)) {
    await tanganiNuke(guild, client, 'channel');
  }
});

// ── Anti-nuke: role deleted ──────────────────────────────────────────────────
client.on('roleDelete', async (role) => {
  if (deteksiNuke(`role:${role.id}`)) {
    await tanganiNuke(role.guild, client, 'role');
  }
});

// ── Starboard ─────────────────────────────────────────────────────────────────
client.on('messageReactionAdd', async (reaction, user) => {
  await handleStarboard(reaction, user);
});

// ── Member masuk ──────────────────────────────────────────────────────────────
client.on('guildMemberAdd', async (member) => {
  // Raid detection
  if (deteksiRaid(member)) {
    await tanganiRaid(member.guild, client);
    return;
  }
  if (process.env.BOT_EVENTS_ENABLED === 'true') {
    try {
      const event = createEvent('member.joined', member.guild.id, {}, { entityId: member.id });
      await prisma.$transaction((transaction) => publishEvent(transaction, event));
    } catch (error) {
      logger.error(error, '[julian] gagal publish member.joined');
    }
  }

  const inviteInfo = await findInviter(member);
  if (inviteInfo?.inviter && !member.user.bot) {
    recordInvite(member.guild.id, inviteInfo.inviter, member.id);
  }

  // Auto-role
  const autoRole = process.env.JULIAN_ROLE_OTOMATIS;
  if (autoRole) {
    const role = member.guild.roles.cache.find(r => r.name === autoRole);
    if (role) await member.roles.add(role).catch(() => {});
  }

  // ── Welcome embed ke #welcome ──
  const welcomeChannelId = process.env.JULIAN_CHANNEL_SAMBUTAN_ID || CHANNELS.welcome;
  const welcomeCh = member.guild.channels.cache.get(welcomeChannelId) as TextChannel | undefined;
  
  if (welcomeCh) {
    try {
      const avatarURL = member.displayAvatarURL({ extension: 'png', size: 256 });
      const { buatKartu } = await import('./utils/kartu');
      
      const buffer = await buatKartu(
        member.displayName, 
        avatarURL, 
        member.guild.memberCount, 
        member.guild.name
      );

      const attachment = new AttachmentBuilder(buffer, { name: 'welcome-card.gif' });
      
      const welcomeText = `Halo ${member.toString()}, selamat datang di **${member.guild.name}**! 🎉\n\n` +
        `📌 Mampir ke <#${CHANNELS.rules}> dulu ya, biar tau aturan mainnya.\n` +
        `💬 Kalau mau kenalan atau nanya seputar server, langsung aja ke <#${CHANNELS.general}>.\n` +
        `🤖 Ada bot yang bisa diajak ngobrol juga lho — mention aja Dirga di channel chat.` +
        (inviteInfo?.inviter ? `\n\n👤 Diajak sama <@${inviteInfo.inviter}> • kode: \`${inviteInfo.code}\`` : '');

      await welcomeCh.send({ content: welcomeText }).catch(() => {});
      await welcomeCh.send({ files: [attachment] }).catch(() => {});
    } catch (e) {
      logger.error(e, '[julian] gagal buat kartu sambutan');
      const embed = new EmbedBuilder()
        .setTitle(`🌊 Hei, ${member.displayName} baru gabung!`)
        .setDescription(
          `Selamat datang di **${member.guild.name}** ${member} 🎉\n\n` +
          `Sekarang ada **${member.guild.memberCount.toLocaleString()} orang** di sini.\n\n` +
          `📌 Mampir ke <#${CHANNELS.rules}> dulu ya, biar tau aturan mainnya.\n` +
          `💬 Kalau mau kenalan atau nanya seputar server, langsung aja ke <#${CHANNELS.general}>.\n` +
          `🤖 Ada bot yang bisa diajak ngobrol juga lho — mention aja Dirga di channel chat.` +
          (inviteInfo?.inviter ? `\n\n👤 Diajak sama <@${inviteInfo.inviter}> • kode: \`${inviteInfo.code}\`` : '')
        )
        .setColor(0x57f287)
        .setThumbnail(member.displayAvatarURL({ size: 256 }))
        .setFooter({ text: `ID: ${member.id}` })
        .setTimestamp();
      await welcomeCh.send({ content: member.toString(), embeds: [embed] }).catch(() => {});
    }
  }

  // ── DM Sambutan ──
  try {
    const dmMessage = [
      `Halo ${member.displayName}, selamat dateng di **${member.guild.name}**.`,
      `Baca dulu aturannya di <#${CHANNELS.rules}> ya.`,
      `Kalau nyari bahan bacaan atau info, ada di <#${CHANNELS.resources}>.`,
      `Kalau ada masalah atau mau lapor sesuatu, tinggal buka tiket, nanti diobrolin berdua sama moderator.`
    ].join('\n');
    await member.send(dmMessage);
  } catch (error) {
    logger.info(`[julian] DM sambutan gagal untuk ${member.user.tag}`);
  }

  // ── Log ke #log-server ──
  const logChannelId = process.env.LOG_CHANNEL_ID || CHANNELS.logServer;
  const logCh = member.guild.channels.cache.get(logChannelId) as TextChannel | undefined;
  if (logCh) {
    const logEmbed = new EmbedBuilder()
      .setTitle('📥 Member baru join')
      .setDescription(
        `${member.toString()} (${member.user.tag}) gabung ke server.` +
        (inviteInfo?.inviter ? ` Diajak oleh <@${inviteInfo.inviter}>.` : '')
      )
      .setColor(Colors.Green)
      .setTimestamp();
    await logCh.send({ embeds: [logEmbed] }).catch(() => {});
  }
});

// ── Member keluar ─────────────────────────────────────────────────────────────
client.on('guildMemberRemove', async (member) => {
  const logChannelId = process.env.LOG_CHANNEL_ID || CHANNELS.logServer;
  if (!logChannelId) return;
  const channel = member.guild.channels.cache.get(logChannelId) as TextChannel | undefined;
  if (!channel) return;
  const embed = new EmbedBuilder()
    .setTitle('📤 Member keluar')
    .setDescription(`${member.toString()} (${member.user.tag}) ninggalin server.`)
    .setColor(Colors.Orange)
    .setTimestamp();
  await channel.send({ embeds: [embed] }).catch(() => {});
});

// ── Unban listener ─────────────────────────────────────────────────────────
client.on('guildBanRemove', async (ban) => {
  const logChannelId = process.env.LOG_CHANNEL_ID || CHANNELS.logServer;
  if (!logChannelId) return;
  const channel = ban.guild.channels.cache.get(logChannelId) as TextChannel | undefined;
  if (!channel) return;
  const embed = new EmbedBuilder()
    .setTitle('🔓 Member di-unban')
    .setDescription(`${ban.user?.tag ?? 'Unknown'} di-unban dari server.`)
    .setColor(Colors.Green)
    .setTimestamp();
  await channel.send({ embeds: [embed] }).catch(() => {});
});

// ── Role perubahan bahaya ─────────────────────────────────────────────────
const DANGER_ROLES = ['Administrator', 'Moderator', 'Manage Server'];
client.on('guildMemberUpdate', async (oldMember, newMember) => {
  if (oldMember.roles.cache.size === newMember.roles.cache.size) return;
  const added = newMember.roles.cache.filter(r => !oldMember.roles.cache.has(r.id));
  const danger = added.filter(r => r.permissions.has('Administrator') || DANGER_ROLES.includes(r.name));
  if (danger.size === 0) return;
  const logChannelId = process.env.LOG_CHANNEL_ID || CHANNELS.logServer;
  if (!logChannelId) return;
  const channel = newMember.guild.channels.cache.get(logChannelId) as TextChannel | undefined;
  if (!channel) return;
  const embed = new EmbedBuilder()
    .setTitle('⚠️ Role Berbahaya')
    .setDescription(`${newMember.toString()} dapet role: ${danger.map(r => r.toString()).join(', ')}`)
    .setColor(Colors.Red)
    .setTimestamp();
  await channel.send({ embeds: [embed] }).catch(() => {});
});

// ── Server baru ───────────────────────────────────────────────────────────────
client.on('guildCreate', async (guild) => {
  await refreshInvites(guild);
});

client.login(process.env.JULIAN_TOKEN).catch((err) => {
  logger.error(err, '[julian] login gagal — cek JULIAN_TOKEN di .env');
});
