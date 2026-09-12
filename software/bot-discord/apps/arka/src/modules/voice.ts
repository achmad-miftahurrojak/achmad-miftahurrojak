import { Client, VoiceState, TextChannel, EmbedBuilder, Colors, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } from 'discord.js';
import { logger } from '@hamin/utils';

const CHANNEL_LAPORAN_AFK_ID = process.env.JULIAN_CHANNEL_LAPORAN_AFK_ID || '1535214549765197834';
const AUTO_AFK = true;
const AFK_WARN_DETIK = 300;
const AFK_ROLE_BEBAS: string[] = [];
const DM_SAAT_AFK = true;
const JEDA_DM_AFK_MENIT = 60;
const AFK_TOMBOL_AKTIF = true;
const AFK_TOMBOL_DETIK = 60;
const AFK_KEBAL_MENIT = 15;
const AFK_MAKS_KONFIRMASI = 3;

const PESAN_AFK = [
  'lo kelamaan diem di {asal}, jadi kelempar ke {afk}. balik aja kalo mau lanjut',
  'ketauan afk di {asal} wkwk. udah dipindah, santai bukan ditendang kok',
  'mic lo sepi mulu di {asal}, sistem ngira lo ketiduran. sekarang lo di {afk}',
  'dari {asal} pindah ke {afk}, soalnya ga ada suara daritadi. tinggal join lagi',
  'gua ga ngapa ngapain ya, discord sendiri yang mindahin lo dari {asal} ke {afk}'
];

const dmAfk: Record<string, number> = {};
const tugasAfk: Record<string, NodeJS.Timeout> = {};
const konfirmasi: Record<string, number> = {};

function isSilent(voiceState: VoiceState): boolean {
  return !!(voiceState.selfMute || voiceState.selfDeaf);
}

function isImmune(member: any): boolean {
  if (!member || !member.roles) return false;
  return AFK_ROLE_BEBAS.some((roleName) => member.roles.cache.some((r: any) => r.name === roleName));
}

function getRemainingQuota(memberId: string): number | null {
  if (!AFK_MAKS_KONFIRMASI) return null;
  return Math.max(0, AFK_MAKS_KONFIRMASI - (konfirmasi[memberId] || 0));
}

async function reportAfk(client: Client, guild: any, text: string, color: number) {
  if (!CHANNEL_LAPORAN_AFK_ID) return;
  const channel = client.channels.cache.get(CHANNEL_LAPORAN_AFK_ID) as TextChannel;
  if (!channel) return;
  
  try {
    const embed = new EmbedBuilder()
      .setDescription(text)
      .setColor(color)
      .setTimestamp();
    await channel.send({ embeds: [embed] });
  } catch (error) {
    logger.warn('Tidak punya izin kirim ke channel laporan AFK');
  }
}

async function notifyAfkDm(member: any, fromChannel: any) {
  if (!DM_SAAT_AFK && !CHANNEL_LAPORAN_AFK_ID) return;
  
  const now = Date.now();
  const lastDm = dmAfk[member.id];
  if (lastDm && now - lastDm < JEDA_DM_AFK_MENIT * 60 * 1000) return;

  const fromName = fromChannel ? fromChannel.name : 'voice';
  const fromMention = fromChannel ? `<#${fromChannel.id}>` : 'voice';
  
  if (CHANNEL_LAPORAN_AFK_ID) {
    const reportChannel = member.client.channels.cache.get(CHANNEL_LAPORAN_AFK_ID) as TextChannel;
    if (reportChannel) {
      const embed = new EmbedBuilder()
        .setAuthor({ name: member.displayName, iconURL: member.displayAvatarURL() })
        .setDescription(`${member.toString()} kelempar ke AFK dari ${fromMention} karena ga ada suara.`)
        .setColor(Colors.DarkGrey)
        .setTimestamp();
      
      try {
        await reportChannel.send({ embeds: [embed] });
      } catch (err) {
        // ignore
      }
    }
  }

  if (DM_SAAT_AFK) {
    const afkChannel = member.guild.afkChannel;
    const afkMention = afkChannel ? `<#${afkChannel.id}>` : 'AFK';
    const messageTemplate = PESAN_AFK[Math.floor(Math.random() * PESAN_AFK.length)];
    const message = messageTemplate.replace('{asal}', fromMention).replace('{afk}', afkMention);
    
    try {
      await member.send(message);
      logger.info(`[afk] DM terkirim ke ${member.displayName}`);
    } catch (err) {
      logger.info(`[afk] DM ${member.displayName} ketutup, dilewat`);
    }
  }
  
  dmAfk[member.id] = now;
}

async function askForConfirmation(client: Client, member: any, channel: any): Promise<boolean> {
  const reportChannel = client.channels.cache.get(CHANNEL_LAPORAN_AFK_ID) as TextChannel;
  if (!AFK_TOMBOL_AKTIF || !reportChannel) {
    await new Promise(r => setTimeout(r, AFK_TOMBOL_DETIK * 1000));
    return false;
  }
  
  const remaining = getRemainingQuota(member.id);
  
  if (remaining === 0) {
    const embed = new EmbedBuilder()
      .setAuthor({ name: member.displayName, iconURL: member.displayAvatarURL() })
      .setTitle('Jatah konfirmasi habis')
      .setDescription(`${member.toString()} udah konfirmasi **${AFK_MAKS_KONFIRMASI} kali** tapi mic-nya ga pernah nyala di <#${channel.id}>.\nKali ini ga ada tombol. **${AFK_TOMBOL_DETIK} detik** lagi dipindah ke AFK kalau mic-nya masih mati.`)
      .setColor(Colors.Orange)
      .setFooter({ text: 'Buka mic buat batalin, terus jatahnya balik penuh' })
      .setTimestamp();
      
    try {
      await reportChannel.send({ content: member.toString(), embeds: [embed] });
    } catch (err) {
      // ignore
    }
    await new Promise(r => setTimeout(r, AFK_TOMBOL_DETIK * 1000));
    return false;
  }
  
  const embed = new EmbedBuilder()
    .setAuthor({ name: member.displayName, iconURL: member.displayAvatarURL() })
    .setTitle('Masih di situ ga?')
    .setDescription(`${member.toString()} udah diem **${Math.floor(AFK_WARN_DETIK / 60)} menit** di <#${channel.id}>.\nPencet tombol di bawah dalam **${AFK_TOMBOL_DETIK} detik** kalau ga mau dipindah ke AFK. Mic boleh tetep mati.`)
    .setColor(Colors.Yellow)
    .setTimestamp();
    
  if (remaining === null) {
    embed.setFooter({ text: 'Didiemin sampai waktunya habis = otomatis dipindah' });
  } else {
    embed.setFooter({ text: `Sisa jatah konfirmasi: ${remaining}. Nyalain mic sekali buat balikin jatahnya penuh.` });
  }
  
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`afk_confirm:${member.id}`)
      .setLabel('Masih di sini')
      .setEmoji('🙋')
      .setStyle(ButtonStyle.Success)
  );
  
  let msg;
  try {
    msg = await reportChannel.send({
      content: member.toString(),
      embeds: [embed],
      components: [row]
    });
  } catch (err) {
    await new Promise(r => setTimeout(r, AFK_TOMBOL_DETIK * 1000));
    return false;
  }
  
  try {
    const collector = msg.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: AFK_TOMBOL_DETIK * 1000
    });
    
    return new Promise((resolve) => {
      collector.on('collect', async (i) => {
        if (i.user.id !== member.id) {
          await i.reply({ content: 'Tombol ini bukan buat lo.', ephemeral: true });
          return;
        }
        
        konfirmasi[member.id] = (konfirmasi[member.id] || 0) + 1;
        const newRemaining = getRemainingQuota(member.id);
        let note = `Dikonfirmasi. Aman dari pantauan ${AFK_KEBAL_MENIT} menit ke depan.`;
        if (newRemaining !== null) {
          note += newRemaining ? ` Sisa jatah: ${newRemaining}.` : ' Jatahnya habis, konfirmasi berikutnya ga bisa lagi.';
        }
        
        const disabledRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId(`afk_confirm:${member.id}`)
            .setLabel('Udah dikonfirmasi')
            .setEmoji('🙋')
            .setStyle(ButtonStyle.Success)
            .setDisabled(true)
        );
        
        const successEmbed = EmbedBuilder.from(embed).setColor(Colors.Green).setFooter({ text: note });
        await i.update({ embeds: [successEmbed], components: [disabledRow] });
        resolve(true);
      });
      
      collector.on('end', async (collected, reason) => {
        if (reason === 'time') {
          const disabledRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
              .setCustomId(`afk_confirm:${member.id}`)
              .setLabel('Waktu habis')
              .setEmoji('🙋')
              .setStyle(ButtonStyle.Secondary)
              .setDisabled(true)
          );
          try {
            await msg.edit({ components: [disabledRow] });
          } catch(e) {}
          resolve(false);
        }
      });
    });
  } catch (err) {
    return false;
  }
}

async function startCountdown(client: Client, member: any, channel: any) {
  const loop = async () => {
    while (true) {
      await new Promise(r => setTimeout(r, AFK_WARN_DETIK * 1000));
      
      const currentVoice = member.guild.members.cache.get(member.id)?.voice;
      if (!currentVoice || currentVoice.channelId !== channel.id || !isSilent(currentVoice)) {
        return;
      }
      
      try {
        const afkChannel = member.guild.afkChannel;
        const afkMention = afkChannel ? `<#${afkChannel.id}>` : 'AFK';
        if (AFK_TOMBOL_AKTIF && CHANNEL_LAPORAN_AFK_ID) {
          await member.send(`lo diem terus di <#${channel.id}>. buka <#${CHANNEL_LAPORAN_AFK_ID}> terus pencet tombolnya dalam ${AFK_TOMBOL_DETIK} detik kalau ga mau dipindah ke ${afkMention}`);
        } else {
          await member.send(`lo diem terus di <#${channel.id}>. ${AFK_TOMBOL_DETIK} detik lagi gua pindahin ke ${afkMention} kalau masih gini`);
        }
      } catch (err) {
        // ignore
      }
      
      const passed = await askForConfirmation(client, member, channel);
      if (passed) {
        logger.info(`[afk] ${member.displayName} konfirmasi masih online`);
        await new Promise(r => setTimeout(r, AFK_KEBAL_MENIT * 60 * 1000));
        
        const checkVoice = member.guild.members.cache.get(member.id)?.voice;
        if (!checkVoice || checkVoice.channelId !== channel.id || !isSilent(checkVoice)) {
          return;
        }
        continue;
      }
      
      const finalVoice = member.guild.members.cache.get(member.id)?.voice;
      if (!finalVoice || finalVoice.channelId !== channel.id || !isSilent(finalVoice)) {
        return;
      }
      
      const afk = member.guild.afkChannel;
      if (!afk) {
        logger.info('[afk] channel AFK belum diset di Server Settings');
        return;
      }
      
      try {
        await member.voice.setChannel(afk, 'Auto AFK: diem kelamaan');
        await reportAfk(client, member.guild, `${member.toString()} dipindah dari <#${channel.id}> ke <#${afk.id}>`, Colors.Orange);
        try {
          const afkMention = `<#${afk.id}>`;
          const msg = PESAN_AFK[Math.floor(Math.random() * PESAN_AFK.length)].replace('{asal}', `<#${channel.id}>`).replace('{afk}', afkMention);
          await member.send(msg);
        } catch (err) {}
        logger.info(`[afk] ${member.displayName} dipindah ke AFK`);
      } catch (err) {
        logger.warn('[afk] GAGAL mindahin. Bot butuh izin Move Members');
      }
      return;
    }
  };

  loop().finally(() => {
    delete tugasAfk[member.id];
  });
}

export function handleVoiceStateUpdate(client: Client, oldState: VoiceState, newState: VoiceState) {
  const member = newState.member;
  if (!member || member.user.bot) return;

  if (!AUTO_AFK || isImmune(member)) return;

  const afkChannel = newState.guild.afkChannel;
  const newChannel = newState.channel;
  const left = !newChannel || (afkChannel && newChannel.id === afkChannel.id);
  
  if (left || !isSilent(newState)) {
    delete konfirmasi[member.id];
    if (tugasAfk[member.id]) {
      clearTimeout(tugasAfk[member.id]); // It's not a direct timeout, we should perhaps rethink the cancellation mechanism
      delete tugasAfk[member.id];
    }
    return;
  }

  // Check if they just moved into the AFK channel directly
  if (oldState.channelId !== newState.channelId) {
    if (afkChannel && newState.channelId === afkChannel.id) {
      notifyAfkDm(member, oldState.channel);
    }
  }

  if (!tugasAfk[member.id]) {
    // Instead of clearTimeout, we can rely on the loop checking voice state repeatedly.
    // However, it's better to store an abort controller or just let it naturaly exit if voice state changes.
    // The loop inherently exits if !isSilent(voice) or channel changes, so we just set a dummy timeout object to mark it active.
    tugasAfk[member.id] = setTimeout(() => {}, 0); 
    startCountdown(client, member, newChannel);
  }
}
