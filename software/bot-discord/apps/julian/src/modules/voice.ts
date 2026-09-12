import { Client, VoiceState, TextChannel, EmbedBuilder, Colors, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, Message } from 'discord.js';
import * as fs from 'fs';
import * as path from 'path';
import { logger, CHANNELS } from '@hamin/utils';

const SESI_VOICE_FILE = path.join(process.cwd(), 'data', 'sesi-voice.json');

interface VoiceSession {
  userId: string;
  channelId: string;
  channelName: string;
  joinTime: string;
}

function loadSesi(): Map<string, VoiceSession> {
  try {
    if (!fs.existsSync(path.dirname(SESI_VOICE_FILE))) fs.mkdirSync(path.dirname(SESI_VOICE_FILE), { recursive: true });
    if (!fs.existsSync(SESI_VOICE_FILE)) return new Map();
    const data = JSON.parse(fs.readFileSync(SESI_VOICE_FILE, 'utf-8'));
    return new Map(Object.entries(data));
  } catch { return new Map(); }
}

function saveSesi(sesi: Map<string, VoiceSession>) {
  const obj: Record<string, VoiceSession> = {};
  for (const [k, v] of sesi) obj[k] = v;
  fs.writeFileSync(SESI_VOICE_FILE, JSON.stringify(obj, null, 2));
}

function startSesi(userId: string, channelId: string, channelName: string) {
  const sesi = loadSesi();
  sesi.set(userId, { userId, channelId, channelName, joinTime: new Date().toISOString() });
  saveSesi(sesi);
}

function endSesi(userId: string): VoiceSession | null {
  const sesi = loadSesi();
  const s = sesi.get(userId);
  if (!s) return null;
  sesi.delete(userId);
  saveSesi(sesi);
  return s;
}

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
const tugasAfk: Record<string, symbol> = {};
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

async function startCountdown(client: Client, member: any, channel: any, token: symbol) {
  const loop = async () => {
    while (true) {
      await new Promise(r => setTimeout(r, AFK_WARN_DETIK * 1000));
      if (tugasAfk[member.id] !== token) return;
      
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
      if (tugasAfk[member.id] !== token) return;
      
      if (passed) {
        logger.info(`[afk] ${member.displayName} konfirmasi masih online`);
        await new Promise(r => setTimeout(r, AFK_KEBAL_MENIT * 60 * 1000));
        if (tugasAfk[member.id] !== token) return;
        
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
    if (tugasAfk[member.id] === token) {
      delete tugasAfk[member.id];
    }
  });
}

async function laporAktivitasVoice(client: Client, oldState: VoiceState, newState: VoiceState) {
  const logChannelId = process.env.LOG_CHANNEL_ID || CHANNELS.logServer;
  if (!logChannelId) return;

  const channel = client.channels.cache.get(logChannelId) as TextChannel | undefined;
  if (!channel) return;

  const member = newState.member || oldState.member;
  if (!member || member.user.bot) return;

  const oldCh = oldState.channel;
  const newCh = newState.channel;

  let deskripsi = '';
  let warna: any = Colors.Grey;

  // 1. Join Voice
  if (!oldCh && newCh) {
    deskripsi = `📥 **${member.displayName}** join voice <#${newCh.id}>`;
    warna = Colors.Green;
    startSesi(member.id, newCh.id, newCh.name);
  }
  // 2. Leave Voice
  else if (oldCh && !newCh) {
    deskripsi = `📤 **${member.displayName}** leave voice <#${oldCh.id}>`;
    warna = Colors.Red;
    const sesi = endSesi(member.id);
    if (sesi) {
      const durasi = Math.floor((Date.now() - new Date(sesi.joinTime).getTime()) / 60000);
      if (durasi >= 1) deskripsi += ` (⏱️ ${durasi} mnt)`;
    }
  }
  // 3. Pindah Channel
  else if (oldCh && newCh && oldCh.id !== newCh.id) {
    // Jangan lapor kalau cuma pindah ke channel AFK bawaan Discord (karena sudah di-handle auto-AFK log)
    const afkChannel = newState.guild.afkChannel;
    if (afkChannel && newCh.id === afkChannel.id) {
      endSesi(member.id);
      return;
    }

    deskripsi = `🔁 **${member.displayName}** pindah dari <#${oldCh.id}> ke <#${newCh.id}>`;
    warna = Colors.Blue;
    const sesi = endSesi(member.id);
    if (sesi) {
      const durasi = Math.floor((Date.now() - new Date(sesi.joinTime).getTime()) / 60000);
      if (durasi >= 1) deskripsi += ` (⏱️ ${durasi} mnt di ${oldCh.name})`;
    }
    startSesi(member.id, newCh.id, newCh.name);
  }

  if (deskripsi) {
    try {
      const embed = new EmbedBuilder()
        .setDescription(deskripsi)
        .setColor(warna)
        .setTimestamp();
      await channel.send({ embeds: [embed] });
    } catch (err) {
      // ignore
    }
  }
}

export function handleVoiceStateUpdate(client: Client, oldState: VoiceState, newState: VoiceState) {
  const member = newState.member;
  if (!member || member.user.bot) return;

  // Lapor aktivitas voice join/leave/move ke channel log
  laporAktivitasVoice(client, oldState, newState).catch(() => {});

  if (!AUTO_AFK || isImmune(member)) return;

  const afkChannel = newState.guild.afkChannel;
  const newChannel = newState.channel;
  const left = !newChannel || (afkChannel && newChannel.id === afkChannel.id);
  
  if (left || !isSilent(newState)) {
    delete konfirmasi[member.id];
    delete tugasAfk[member.id];
    return;
  }

  // Check if they just moved into the AFK channel directly
  if (oldState.channelId !== newState.channelId) {
    if (afkChannel && newState.channelId === afkChannel.id) {
      notifyAfkDm(member, oldState.channel);
    }
  }

  if (!tugasAfk[member.id]) {
    const token = Symbol();
    tugasAfk[member.id] = token; 
    startCountdown(client, member, newChannel, token);
  }
}

// ============================================================
// VOICE ACTIVITY — embed live siapa di voice, update tiap 10 menit
// ============================================================

let voiceActivityMessageId: string | null = null;
let voiceActivityChannelId: string | null = null;

export async function updateVoiceActivity(client: Client) {
  try {
    const guild = client.guilds.cache.first();
    if (!guild) return;

    // Kumpulkan semua member di voice (bukan bot)
    const voiceChannels = guild.channels.cache.filter(ch => ch.isVoiceBased());
    const aktif: { channelId: string; channelName: string; members: string[] }[] = [];

    for (const [, ch] of voiceChannels) {
      if (!ch.isVoiceBased()) continue;
      if (guild.afkChannel && ch.id === guild.afkChannel.id) continue; // Skip AFK channel
      
      const members = [...ch.members.values()].filter(m => !m.user.bot);
      if (members.length > 0) {
        aktif.push({
          channelId: ch.id,
          channelName: ch.name,
          members: members.map(m => `${m.displayName}`),
        });
      }
    }

    const generalChannel = guild.channels.cache.get(CHANNELS.general) as TextChannel | undefined;
    if (!generalChannel) return;

    // Kalau semua voice kosong, hapus embed lama
    if (aktif.length === 0) {
      if (voiceActivityMessageId && voiceActivityChannelId) {
        try {
          const oldMsg = await generalChannel.messages.fetch(voiceActivityMessageId).catch(() => null);
          if (oldMsg) await oldMsg.delete().catch(() => {});
        } catch { /* abaikan */ }
        voiceActivityMessageId = null;
        voiceActivityChannelId = null;
      }
      return;
    }

    // Buat embed daftar voice aktif
    const baris = aktif.map(item =>
      `**🔊 <#${item.channelId}>**\n${item.members.map(n => `  • ${n}`).join('\n')}`
    ).join('\n\n');

    const embed = new EmbedBuilder()
      .setTitle('🎙️ Lagi online di voice')
      .setDescription(baris)
      .setColor(0x5865f2)
      .setFooter({ text: 'Update tiap 10 menit · hanya member aktif' })
      .setTimestamp();

    // Edit pesan lama kalau ada, kalau tidak kirim baru
    const channelMentions = aktif.map(item => `<#${item.channelId}>`).join(' ');
    const contentText = `🎙️ **Informasi Voice Channel Aktif:** ${channelMentions}`;
    
    if (voiceActivityMessageId) {
      try {
        const oldMsg = await generalChannel.messages.fetch(voiceActivityMessageId).catch(() => null);
        if (oldMsg && oldMsg.editable) {
          await oldMsg.edit({ content: contentText, embeds: [embed] });
          return;
        }
      } catch { /* kalau gagal, kirim baru */ }
    }

    const newMsg = await generalChannel.send({ content: contentText, embeds: [embed] });
    voiceActivityMessageId = newMsg.id;
    voiceActivityChannelId = generalChannel.id;
  } catch (err: any) {
    logger.error({ err: String(err).slice(0, 200) }, '[voice-activity] error update embed');
  }
}

export function startVoiceActivityLoop(client: Client) {
  // Update langsung saat dipanggil, lalu tiap 10 menit
  updateVoiceActivity(client).catch(() => {});
  setInterval(() => {
    updateVoiceActivity(client).catch(() => {});
  }, 10 * 60 * 1000);

  logger.info('[voice-activity] loop aktif (interval 10 menit)');
}
