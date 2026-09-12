import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  Message,
  EmbedBuilder,
  GuildMember,
  TextBasedChannel,
  TextChannel,
  MessageReaction,
  User,
  PartialUser,
  Snowflake
} from 'discord.js';
import { logger } from '@hamin/utils';
import { Command } from '../handler';
import { WARNA, LOMBA_HADIAH, ACARA_INGETIN, ACARA_DM, EMOJI_IKUT, EMOJI_VOTE, ROLE_SOAL } from '../config';
import { diArena, beriXp, catatMain, prisma } from '../gameCore';
import { getArkaGlobal } from '../core';

// ============================================================
// Penyimpanan lomba & acara (JSON di ArkaGlobal.lombaAcara)
// ============================================================

interface Kiriman {
  pesan: string;
  orang: string;
}

interface LombaAktif {
  judul: string;
  tutup: string; // ISO
  kiriman: Kiriman[];
}

interface AcaraAktif {
  nama: string;
  waktu: string; // ISO
  channel: string;
  pesan: string;
  pembuat: string;
  diingetin: boolean;
  dimulai: boolean;
}

async function bacaLombaAcara(): Promise<{ lomba: Record<string, LombaAktif>; acara: AcaraAktif[] }> {
  const g = await getArkaGlobal();
  const isi = (g as any).lombaAcara ?? {};
  return { lomba: isi.lomba ?? {}, acara: isi.acara ?? [] };
}

async function tulisLombaAcara(isi: { lomba: Record<string, LombaAktif>; acara: AcaraAktif[] }) {
  await prisma.arkaGlobal.update({ where: { id: 1 }, data: { lombaAcara: isi } as any });
}

// ============================================================
// Lomba
// ============================================================

function lombaAktif(data: { lomba: Record<string, LombaAktif> }, channelId: string): LombaAktif | undefined {
  return data.lomba[channelId];
}

async function ambilVoters(reaction: MessageReaction): Promise<string[]> {
  const users = await reaction.users.fetch();
  return users.filter((u) => !u.bot).map((u) => u.id);
}

async function tutupLomba(client: any, channel: any, data: { lomba: Record<string, LombaAktif>; acara: AcaraAktif[] }, channelId: string, otomatis = false): Promise<boolean> {
  const lomba = data.lomba[channelId];
  if (!lomba) return false;
  const pemilihGlobal = new Map<string, number>();
  const hasilMentah: { orangId: string; tautan: string; pemilih: string[]; idx: number }[] = [];
  for (let i = 0; i < lomba.kiriman.length; i++) {
    const kiriman = lomba.kiriman[i];
    try {
      const pesan = await channel.messages.fetch(kiriman.pesan);
      const pemilih: string[] = [];
      for (const [, reaksi] of pesan.reactions.cache) {
        if (reaksi.emoji.name !== EMOJI_VOTE && reaksi.emoji.toString() !== EMOJI_VOTE) continue;
        for (const uid of await ambilVoters(reaksi)) {
          if (uid !== kiriman.orang) pemilih.push(uid);
        }
      }
      hasilMentah.push({ orangId: kiriman.orang, tautan: pesan.url, pemilih, idx: i });
    } catch {
      continue;
    }
  }
  const skor = new Map<number, number>();
  for (const hasil of hasilMentah) skor.set(hasil.idx, 0);
  for (const { pemilih, idx } of hasilMentah) {
    for (const uid of pemilih) {
      if (pemilihGlobal.has(uid)) continue;
      pemilihGlobal.set(uid, idx);
      skor.set(idx, (skor.get(idx) ?? 0) + 1);
    }
  }
  const hasilAkhir = hasilMentah.map((h) => ({
    orangId: h.orangId,
    suara: skor.get(h.idx) ?? 0,
    tautan: h.tautan
  }));
  hasilAkhir.sort((a, b) => b.suara - a.suara);
  delete data.lomba[channelId];
  await tulisLombaAcara(data);

  if (hasilAkhir.length === 0) {
    await channel.send(`?? Lomba **${lomba.judul}** ditutup, tapi ga ada yang ngirim. Sayang banget.`);
    return true;
  }
  const baris: string[] = [];
  for (let i = 0; i < Math.min(3, hasilAkhir.length); i++) {
    const { orangId, suara: suaraMasuk, tautan } = hasilAkhir[i];
    let nama = 'entah siapa';
    try {
      const anggota = await channel.guild.members.fetch(orangId);
      nama = anggota.displayName;
    } catch {}
    const tanda = ['??', '??', '??'][i];
    const hadiah = LOMBA_HADIAH[i] ?? 0;
    baris.push(`${tanda} **${nama}** � ${suaraMasuk} suara � +${hadiah} XP\n\u3000\u3000[liat karyanya](${tautan})`);
    if (hadiah) {
      await catatMain(orangId, 'lomba', i === 0);
      await beriXp(client, channel.guild, orangId, hadiah);
    }
  }
  const isi = new EmbedBuilder()
    .setColor(WARNA)
    .setTitle(`??  Hasil ${lomba.judul}`)
    .setDescription(baris.join('\n'))
    .setFooter({
      text: `${hasilAkhir.length} karya masuk � 1 orang = 1 suara` + (otomatis ? ' � ditutup otomatis' : '')
    });
  await channel.send({ embeds: [isi] });
  return true;
}

export const lombaCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('lomba')
    .setDescription('Buka lomba kiriman foto atau gambar')
    .addStringOption((o) => o.setName('judul').setDescription('Nama lombanya').setRequired(true))
    .addIntegerOption((o) => o.setName('jam').setDescription('Lomba dibuka berapa jam. Contoh: 24').setMinValue(1).setMaxValue(168)) as SlashCommandBuilder,

  executeSlash: async (interaction: ChatInputCommandInteraction) => {
    if (!(await diArena(interaction))) return;
    const data = await bacaLombaAcara();
    if (data.lomba[interaction.channelId]) {
      await interaction.reply({
        content: 'Masih ada lomba jalan di sini. Tutup dulu pakai `/lombatutup`.',
        ephemeral: true
      });
      return;
    }
    const jam = interaction.options.getInteger('jam') ?? 24;
    const judul = interaction.options.getString('judul', true);
    const tutup = new Date(Date.now() + jam * 3600_000);
    const isi = new EmbedBuilder()
      .setColor(WARNA)
      .setTitle(`???  ${judul}`)
      .setDescription(
        'Kirim karya lo ke channel ini, satu pesan berisi gambar.\nNanti gua tempelin ??, tinggal member yang milih.\n**Satu orang cuma boleh vote satu karya.**'
      )
      .addFields({ name: 'Ditutup', value: `${formatWib(tutup)} WIB (${jam} jam lagi)` })
      .setFooter({ text: `Ga boleh vote karya sendiri. Juara 1 dapet ${LOMBA_HADIAH[0]} XP` });
    await interaction.reply({ embeds: [isi] });
    data.lomba[interaction.channelId] = {
      judul,
      tutup: tutup.toISOString(),
      kiriman: []
    };
    await tulisLombaAcara(data);
  }
};

export const lombaTutupCommand: Command = {
  data: new SlashCommandBuilder().setName('lombatutup').setDescription('Tutup lomba lebih cepat') as SlashCommandBuilder,

  executeSlash: async (interaction: ChatInputCommandInteraction) => {
    if (!(await diArena(interaction))) return;
    const data = await bacaLombaAcara();
    if (!data.lomba[interaction.channelId]) {
      await interaction.reply({ content: 'Ga ada lomba yang jalan di sini.', ephemeral: true });
      return;
    }
    await interaction.reply('Oke, gua itung suaranya...');
    await tutupLomba(interaction.client, interaction.channel as any, data, interaction.channelId);
  }
};

// ============================================================
// Acara
// ============================================================

function formatWib(d: Date): string {
  return (
    d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', timeZone: 'Asia/Jakarta' }) +
    ', ' +
    d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' }).replace('.', ':')
  );
}

async function bolehUrusAcara(inter: ChatInputCommandInteraction, acara: AcaraAktif): Promise<boolean> {
  if (inter.user.id === acara.pembuat) return true;
  if (!inter.inGuild()) return false;
  const member = await inter.guild!.members.fetch(inter.user.id);
  if (member.permissions.has('ManageGuild') || member.permissions.has('ManageEvents')) return true;
  const punya = new Set(member.roles.cache.map((r) => r.name));
  return ROLE_SOAL.some((r) => punya.has(r));
}

function cariAcara(acaraList: AcaraAktif[], nama: string): AcaraAktif | undefined {
  const namaL = nama.trim().toLowerCase();
  return acaraList.find((a) => a.nama.toLowerCase() === namaL && !a.dimulai);
}

async function pesertaAcara(channel: any, idPesan: string): Promise<GuildMember[]> {
  try {
    const pesan = await channel.messages.fetch(idPesan);
    for (const [, reaksi] of pesan.reactions.cache) {
      if (reaksi.emoji.name === EMOJI_IKUT || reaksi.emoji.toString() === EMOJI_IKUT) {
        const users = await reaksi.users.fetch();
        const ids = [...users.values()].filter((u) => !u.bot).map((u) => u.id);
        const hasil: GuildMember[] = [];
        for (const id of ids) {
          const m = await (channel as any).guild.members.fetch(id).catch(() => null);
          if (m) hasil.push(m);
        }
        return hasil;
      }
    }
    return [];
  } catch {
    return [];
  }
}

async function dmPeserta(orang: GuildMember[], isi: EmbedBuilder): Promise<string[]> {
  const kelewat: string[] = [];
  for (const o of orang) {
    try {
      await o.send({ embeds: [isi] });
    } catch {
      kelewat.push(o.displayName);
    }
  }
  return kelewat;
}

export const acaraCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('acara')
    .setDescription('Bikin acara, orang bisa daftar ikut')
    .addStringOption((o) => o.setName('nama').setDescription('Nama acaranya').setRequired(true))
    .addStringOption((o) => o.setName('jam').setDescription('Jam mulai, format 19:30').setRequired(true))
    .addStringOption((o) => o.setName('catatan').setDescription('Keterangan tambahan, boleh dikosongin')) as SlashCommandBuilder,

  executeSlash: async (interaction: ChatInputCommandInteraction) => {
    if (!(await diArena(interaction))) return;
    const nama = interaction.options.getString('nama', true);
    const jamStr = interaction.options.getString('jam', true);
    const catatan = interaction.options.getString('catatan');

    const cocokJam = jamStr.trim().match(/^(\d{1,2}):(\d{2})$/);
    if (!cocokJam) {
      await interaction.reply({ content: 'Jamnya ditulis kayak `19:30` ya.', ephemeral: true });
      return;
    }
    const j = parseInt(cocokJam[1], 10);
    const m = parseInt(cocokJam[2], 10);
    if (j > 23 || m > 59) {
      await interaction.reply({ content: 'Jamnya ditulis kayak `19:30` ya.', ephemeral: true });
      return;
    }

    // jam mulai berikutnya di WIB
    const sekarangWib = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }));
    const mulaiWib = new Date(sekarangWib);
    mulaiWib.setHours(j, m, 0, 0);
    if (mulaiWib <= sekarangWib) mulaiWib.setDate(mulaiWib.getDate() + 1);
    // konversi balik ke UTC Date
    const offsetMs = new Date().getTime() - sekarangWib.getTime();
    const mulai = new Date(mulaiWib.getTime() + offsetMs);

    const selisihMenit = Math.floor((mulai.getTime() - Date.now()) / 60_000);
    const jamLagi = Math.floor(selisihMenit / 60);
    const menitLagi = selisihMenit % 60;

    const isi = new EmbedBuilder()
      .setColor(WARNA)
      .setTitle(`??  ${nama}`)
      .setDescription(catatan || 'Mencet ? kalau mau ikut.')
      .addFields({ name: 'Mulai', value: `${formatWib(mulai)} WIB\n(${jamLagi} jam ${menitLagi} menit lagi)` })
      .setFooter({
        text:
          `Dibikin ${interaction.user.displayName} � peserta di-ping ${ACARA_INGETIN} menit sebelum mulai` +
          (ACARA_DM ? ' dan dapet DM' : '')
      });
    await interaction.reply({ embeds: [isi] });
    const pesan = await interaction.fetchReply();
    await pesan.react(EMOJI_IKUT).catch(() => {});

    const data = await bacaLombaAcara();
    data.acara.push({
      nama,
      waktu: mulai.toISOString(),
      channel: interaction.channelId,
      pesan: pesan.id,
      pembuat: interaction.user.id,
      diingetin: false,
      dimulai: false
    });
    await tulisLombaAcara(data);
  }
};

export const acaraListCommand: Command = {
  data: new SlashCommandBuilder().setName('acaralist').setDescription('Acara apa aja yang bakal jalan') as SlashCommandBuilder,

  executeSlash: async (interaction: ChatInputCommandInteraction) => {
    if (!(await diArena(interaction))) return;
    const data = await bacaLombaAcara();
    const daftar = data.acara.filter((a) => !a.dimulai).sort((a, b) => a.waktu.localeCompare(b.waktu));
    if (daftar.length === 0) {
      await interaction.reply('Belum ada acara yang dijadwalin.');
      return;
    }
    const baris = daftar.map(
      (a) => `**${a.nama}** � ${formatWib(new Date(a.waktu))} WIB di <#${a.channel}>`
    );
    const isi = new EmbedBuilder()
      .setColor(WARNA)
      .setTitle('??  Acara mendatang')
      .setDescription(baris.join('\n'))
      .setFooter({ text: 'Ubah jam: /acaraedit � Batalin: /acarahapus' });
    await interaction.reply({ embeds: [isi] });
  }
};

export const acaraHapusCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('acarahapus')
    .setDescription('Batalin acara yang belum mulai')
    .addStringOption((o) => o.setName('nama').setDescription('Nama acara yang mau dibatalin').setRequired(true)) as SlashCommandBuilder,

  executeSlash: async (interaction: ChatInputCommandInteraction) => {
    if (!(await diArena(interaction))) return;
    const data = await bacaLombaAcara();
    const acara = cariAcara(data.acara, interaction.options.getString('nama', true));
    if (!acara) {
      await interaction.reply({
        content: `Ga nemu acara itu yang belum mulai. Cek \`/acaralist\`.`,
        ephemeral: true
      });
      return;
    }
    if (!(await bolehUrusAcara(interaction, acara))) {
      await interaction.reply({
        content: 'Cuma yang bikin acara (atau admin) yang boleh batalin.',
        ephemeral: true
      });
      return;
    }
    data.acara = data.acara.filter((a) => a !== acara);
    await tulisLombaAcara(data);
    const channel = interaction.client.channels.cache.get(acara.channel) as TextChannel | undefined;
    if (channel) {
      try {
        const pesan = await channel.messages.fetch(acara.pesan);
        await pesan.reply(`Acara **${acara.nama}** dibatalin sama ${interaction.user.displayName}.`);
      } catch {}
    }
    await interaction.reply(`Oke, **${acara.nama}** gua batalin.`);
  }
};

export const acaraEditCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('acaraedit')
    .setDescription('Ubah jam mulai acara')
    .addStringOption((o) => o.setName('nama').setDescription('Nama acaranya').setRequired(true))
    .addStringOption((o) => o.setName('jam').setDescription('Jam baru, format 19:30').setRequired(true)) as SlashCommandBuilder,

  executeSlash: async (interaction: ChatInputCommandInteraction) => {
    if (!(await diArena(interaction))) return;
    const jamStr = interaction.options.getString('jam', true);
    const cocokJam = jamStr.trim().match(/^(\d{1,2}):(\d{2})$/);
    if (!cocokJam || parseInt(cocokJam[2], 10) > 59 || parseInt(cocokJam[1], 10) > 23) {
      await interaction.reply({ content: 'Jamnya ditulis kayak `19:30` ya.', ephemeral: true });
      return;
    }
    const data = await bacaLombaAcara();
    const acara = cariAcara(data.acara, interaction.options.getString('nama', true));
    if (!acara) {
      await interaction.reply({ content: `Ga nemu acara itu yang belum mulai. Cek \`/acaralist\`.`, ephemeral: true });
      return;
    }
    if (!(await bolehUrusAcara(interaction, acara))) {
      await interaction.reply({ content: 'Cuma yang bikin acara (atau admin) yang boleh ngubah.', ephemeral: true });
      return;
    }
    const j = parseInt(cocokJam[1], 10);
    const m = parseInt(cocokJam[2], 10);
    const sekarangWib = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }));
    const mulaiWib = new Date(sekarangWib);
    mulaiWib.setHours(j, m, 0, 0);
    if (mulaiWib <= sekarangWib) mulaiWib.setDate(mulaiWib.getDate() + 1);
    const offsetMs = new Date().getTime() - sekarangWib.getTime();
    const mulai = new Date(mulaiWib.getTime() + offsetMs);

    acara.waktu = mulai.toISOString();
    acara.diingetin = false;
    await tulisLombaAcara(data);

    const channel = interaction.client.channels.cache.get(acara.channel) as TextChannel | undefined;
    if (channel) {
      try {
        const pesan = await channel.messages.fetch(acara.pesan);
        const embedLama = pesan.embeds[0];
        if (embedLama) {
          const embedBaru = EmbedBuilder.from(embedLama);
          const fieldsLama = embedLama.fields.filter((f) => f.name !== 'Mulai');
          embedBaru.spliceFields(0, embedBaru.data.fields?.length ?? 0);
          const selisihMenit = Math.floor((mulai.getTime() - Date.now()) / 60_000);
          const jamLagi = Math.floor(selisihMenit / 60);
          const menitLagi = selisihMenit % 60;
          embedBaru.addFields(
            { name: 'Mulai', value: `${formatWib(mulai)} WIB\n(${jamLagi} jam ${menitLagi} menit lagi)` },
            ...fieldsLama
          );
          await pesan.edit({ embeds: [embedBaru] });
        }
      } catch (err) {}
    }
    await interaction.reply(`Jam **${acara.nama}** dipindah ke **${formatWib(mulai)} WIB**.`);
  }
};

// ============================================================
// Loop jaga (port tasks.loop jaga_lomba + jaga_acara)
// ============================================================

let loopJalan = false;

export function mulaiLoopLombaAcara(client: any) {
  if (loopJalan) return;
  loopJalan = true;

  setInterval(async () => {
    try {
      const data = await bacaLombaAcara();
      const sekarang = Date.now();
      for (const [chId, lomba] of Object.entries(data.lomba)) {
        if (new Date(lomba.tutup).getTime() <= sekarang) {
          const channel = client.channels.cache.get(chId);
          if (channel) {
            await tutupLomba(client, channel, data, chId, true);
          }
        }
      }
    } catch (err) {
      logger.error(err, '[arka] jaga lomba error');
    }
  }, 120_000);

  setInterval(async () => {
    try {
      const data = await bacaLombaAcara();
      const sisa: AcaraAktif[] = [];
      for (const acara of data.acara) {
        const channel = client.channels.cache.get(acara.channel) as TextChannel | undefined;
        if (!channel) continue;
        const menitLagi = (new Date(acara.waktu).getTime() - Date.now()) / 60_000;
        if (menitLagi <= 0 && !acara.dimulai) {
          const orang = await pesertaAcara(channel, acara.pesan);
          const sebut = orang.map((o) => o.toString()).join(' ') || 'ga ada yang daftar';
          await channel.send(`?? **${acara.nama}** mulai sekarang!\n${sebut}`);
          if (ACARA_DM && orang.length > 0) {
            const kabar = new EmbedBuilder()
              .setColor(WARNA)
              .setTitle(`??  ${acara.nama} mulai sekarang`)
              .setDescription(`Di **${channel.guild.name}**, gabung sekarang.`)
              .addFields({ name: 'Tempatnya', value: `[Buka channelnya](${channel.url})` });
            await dmPeserta(orang, kabar);
          }
          acara.dimulai = true;
          continue;
        }
        if (menitLagi > 0 && menitLagi <= ACARA_INGETIN && !acara.diingetin) {
          const orang = await pesertaAcara(channel, acara.pesan);
          const sebut = orang.map((o) => o.toString()).join(' ');
          await channel.send(
            `? **${acara.nama}** ${Math.floor(menitLagi)} menit lagi. ` +
              (sebut ? sebut : 'Belum ada yang daftar nih.')
          );
          if (ACARA_DM && orang.length > 0) {
            const kabar = new EmbedBuilder()
              .setColor(WARNA)
              .setTitle(`?  ${acara.nama} sebentar lagi`)
              .setDescription(
                `Mulai **${Math.floor(menitLagi)} menit lagi** di **${channel.guild.name}**.`
              )
              .addFields({ name: 'Tempatnya', value: `[Buka channelnya](${channel.url})` })
              .setFooter({ text: 'Lo dapet ini karena mencet ? di pengumuman' });
            const kelewat = await dmPeserta(orang, kabar);
            if (kelewat.length > 0) {
              logger.warn(`[arka] DM acara ketutup buat: ${kelewat.join(', ')}`);
            }
          }
          acara.diingetin = true;
        }
        sisa.push(acara);
      }
      if (sisa.length !== data.acara.length) {
        data.acara = sisa;
        await tulisLombaAcara(data);
      }
    } catch (err) {
      logger.error(err, '[arka] jaga acara error');
    }
  }, 60_000);
}

/** Listener on_message buat lomba: lampirin ?? ke kiriman gambar */
export async function lombaOnMessage(pesan: Message, client: any) {
  if (pesan.author.bot || !pesan.guild) return;
  const data = await bacaLombaAcara();
  const lomba = data.lomba[pesan.channelId];
  if (!lomba || pesan.attachments.size === 0) return;
  lomba.kiriman.push({ pesan: pesan.id, orang: pesan.author.id });
  await tulisLombaAcara(data);
  await pesan.react(EMOJI_VOTE).catch(() => {});
}
