import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  Message,
  EmbedBuilder,
  TextChannel
} from 'discord.js';
import * as fs from 'fs';
import * as path from 'path';
import { logger } from '@hamin/utils';
import { Command } from '../handler';
import { WARNA, BACKUP_BERKAS, CHANNEL_CADANGAN, JAM_BACKUP, ROLE_SOAL } from '../config';
import { diArena } from '../gameCore';

const DATA_DIR = path.join(process.cwd(), '..', '..', 'data');

interface BerkasCadangan {
  nama: string;
  jalur: string;
  ukuran: number;
}

function berkasCadangan(): [BerkasCadangan[], string[]] {
  const siap: BerkasCadangan[] = [];
  const hilang: string[] = [];
  for (const nama of BACKUP_BERKAS) {
    const jalur = path.join(DATA_DIR, nama);
    if (fs.existsSync(jalur)) {
      siap.push({ nama, jalur, ukuran: fs.statSync(jalur).size });
    } else {
      hilang.push(nama);
    }
  }
  return [siap, hilang];
}

async function kirimCadangan(tujuan: TextChannel | any, manual = false): Promise<boolean> {
  const [siap, hilang] = berkasCadangan();
  if (siap.length === 0) return false;
  const total = siap.reduce((a, b) => a + b.ukuran, 0);
  const isi = new EmbedBuilder()
    .setColor(WARNA)
    .setTitle('💾  Cadangan data')
    .setDescription('Simpan file ini. Kalau hosting bermasalah, tinggal upload balik ke folder bot.')
    .addFields({
      name: `${siap.length} file · ${Math.floor(total / 1024)} KB`,
      value: siap.map((b) => `\`${b.nama}\` — ${Math.floor(b.ukuran / 1024)} KB`).join('\n'),
      inline: false
    });
  if (hilang.length > 0) {
    isi.addFields({
      name: 'Ga ketemu',
      value: hilang.map((n) => `\`${n}\``).join(', '),
      inline: false
    });
  }
  isi.setFooter({
    text: (manual ? 'Dikirim manual' : 'Cadangan harian otomatis') + ' · .env sengaja ga pernah ikut'
  });
  const files = siap.map((b) => ({ attachment: b.jalur, name: b.nama }));
  await tujuan.send({ embeds: [isi], files });
  return true;
}

let backupTerakhir = '';

export function mulaiLoopCadangan(client: any) {
  setInterval(async () => {
    try {
      const hari = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
      const jam = parseInt(
        new Date().toLocaleTimeString('en-GB', { hour: '2-digit', hour12: false, timeZone: 'Asia/Jakarta' }),
        10
      );
      if (backupTerakhir === hari || jam < JAM_BACKUP) return;
      let tujuan = CHANNEL_CADANGAN ? client.channels.cache.get(CHANNEL_CADANGAN) : null;
      if (!tujuan) {
        for (const guild of client.guilds.cache.values()) {
          const owner = await guild.fetchOwner().catch(() => null);
          if (owner) {
            tujuan = owner;
            break;
          }
        }
      }
      if (tujuan && (await kirimCadangan(tujuan))) {
        backupTerakhir = hari;
        logger.info('[arka] cadangan harian kekirim');
      }
    } catch (err: any) {
      if (err?.code === 50013) {
        logger.warn('[arka] cadangan gagal kekirim. Cek izin Attach Files di channel cadangan.');
        backupTerakhir = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
      } else {
        logger.error(err, '[arka] cadangan error');
      }
    }
  }, 600_000);
}

export const backupCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('backup')
    .setDescription('Kirim cadangan data sekarang juga') as SlashCommandBuilder,

  executeSlash: async (interaction: ChatInputCommandInteraction) => {
    if (!(await diArena(interaction))) return;
    if (ROLE_SOAL.length > 0) {
      const member = interaction.inGuild()
        ? await interaction.guild?.members.fetch(interaction.user.id)
        : undefined;
      const punya = new Set(member?.roles.cache.map((r) => r.name) ?? []);
      if (!ROLE_SOAL.some((r) => punya.has(r))) {
        await interaction.reply({
          content: 'Yang boleh minta cadangan cuma ' + ROLE_SOAL.join(' atau ') + '.',
          ephemeral: true
        });
        return;
      }
    }
    await interaction.deferReply({ ephemeral: true });
    const tujuan = CHANNEL_CADANGAN
      ? interaction.client.channels.cache.get(CHANNEL_CADANGAN)
      : null;
    const keDm = !tujuan;
    try {
      if (await kirimCadangan(keDm ? interaction.user : tujuan, true)) {
        const kemana = keDm ? 'ke DM lo' : `ke <#${CHANNEL_CADANGAN}>`;
        await interaction.followUp({ content: `Udah gua kirim ${kemana}.`, ephemeral: true });
      } else {
        await interaction.followUp({ content: 'Ga ada file data yang ketemu.', ephemeral: true });
      }
    } catch (err: any) {
      if (err?.code === 50013) {
        await interaction.followUp({
          content: 'Gua ga punya izin ngirim ke situ. Cek izin Attach Files di channel cadangan.',
          ephemeral: true
        });
      } else {
        throw err;
      }
    }
  }
};
