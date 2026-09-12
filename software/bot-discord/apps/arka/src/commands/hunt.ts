import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  Message,
  EmbedBuilder,
  GuildMember
} from 'discord.js';
import { Command } from '../handler';
import { WARNA, HUNT_JEDA, KAIL_PENGALI, CEPAT_JEDA, CEPAT_LAMA, HUNT_TANGKAPAN } from '../config';
import { suara } from '../data/suara';
import {
  diArena,
  beriXp,
  catatMain,
  prisma,
  getArkaUser,
  ambilBarang,
  simpanBarang,
  ambilEfek,
  simpanEfek,
  pilih
} from '../gameCore';
import { majuMisi } from './misi';

const huntTerakhir = new Map<string, number>();

export const huntCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('hunt')
    .setDescription('Jelajah pantai, siapa tau nemu sesuatu') as SlashCommandBuilder,

  executeSlash: async (interaction: ChatInputCommandInteraction) => {
    if (!(await diArena(interaction))) return;
    const userId = interaction.user.id;

    let efek = await ambilEfek(userId);
    let tas = await ambilBarang(userId);

    // efek cepat aktif?
    let masihCepat = false;
    const sampai = efek.cepat_sampai as string | undefined;
    if (sampai) {
      try {
        masihCepat = new Date(sampai) > new Date();
      } catch {
        delete efek.cepat_sampai;
      }
    }
    if (!masihCepat && (tas.cepat ?? 0) > 0) {
      tas.cepat -= 1;
      if (!tas.cepat) delete tas.cepat;
      efek.cepat_sampai = new Date(Date.now() + CEPAT_LAMA * 60_000).toISOString();
      masihCepat = true;
      await simpanBarang(userId, tas);
      await simpanEfek(userId, efek);
    }
    const jeda = masihCepat ? CEPAT_JEDA : HUNT_JEDA;
    const sekarang = Date.now() / 1000;
    const lalu = huntTerakhir.get(userId) ?? 0;
    const sisa = jeda - (sekarang - lalu);
    if (sisa > 0) {
      await interaction.reply({
        content: `Sabar, pantainya baru lo obrak abrik. Tunggu ${Math.floor(sisa)} detik lagi.`,
        ephemeral: true
      });
      return;
    }
    huntTerakhir.set(userId, sekarang);

    // kail otomatis kepakai
    if (!efek.kail && (tas.kail ?? 0) > 0) {
      tas.kail -= 1;
      if (!tas.kail) delete tas.kail;
      efek.kail = 2;
      await simpanBarang(userId, tas);
      await simpanEfek(userId, efek);
    }

    let bobot = HUNT_TANGKAPAN.map((t) => t[2]);
    const pakaiKail = (efek.kail ?? 0) > 0;
    if (pakaiKail) {
      bobot = bobot.map((b, i) => (HUNT_TANGKAPAN[i][3] >= 90 ? b * KAIL_PENGALI : b));
      efek.kail -= 1;
      if (!efek.kail) delete efek.kail;
      await simpanEfek(userId, efek);
    }
    const totalBobot = bobot.reduce((a, b) => a + b, 0);
    let rand = Math.random() * totalBobot;
    let idx = 0;
    for (let i = 0; i < bobot.length; i++) {
      if (rand < bobot[i]) {
        idx = i;
        break;
      }
      rand -= bobot[i];
    }
    const [nama, emoji, , xpDasar] = HUNT_TANGKAPAN[idx];
    let xp = xpDasar;
    let tambahan = '';

    // umpan otomatis kepakai
    if (!efek.umpan && (tas.umpan ?? 0) > 0) {
      tas.umpan -= 1;
      if (!tas.umpan) delete tas.umpan;
      efek.umpan = 3;
      await simpanBarang(userId, tas);
      await simpanEfek(userId, efek);
    }
    if ((efek.umpan ?? 0) > 0) {
      efek.umpan -= 1;
      xp *= 2;
      tambahan += `\n🪝 Umpan Emas: XP dobel. Sisa ${efek.umpan} jelajah.`;
      if (!efek.umpan) delete efek.umpan;
      await simpanEfek(userId, efek);
    }
    if (pakaiKail) {
      tambahan += `\n🎣 Kail Perak kepakai, peluang langka naik. Sisa ${efek.kail ?? 0} jelajah.`;
    }

    // koleksi
    const arkaUser = await getArkaUser(userId);
    const koleksi: Record<string, number> = (arkaUser.koleksi as any) ?? {};
    koleksi[nama] = (koleksi[nama] ?? 0) + 1;
    await prisma.arkaUser.update({ where: { userId }, data: { koleksi } as any });

    const langka = xp >= 150;
    await catatMain(userId, 'hunt', langka);
    await majuMisi(userId, 'hunt', 1, interaction.client);
    await beriXp(interaction.client, interaction.guild, userId, xp);
    const kunci = langka ? 'hunt_langka' : xp <= 10 ? 'hunt_sampah' : 'hunt_dapat';
    await interaction.reply(suara(kunci, { e: emoji, n: nama, x: xp }) + tambahan);
  }
};

export const koleksiCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('koleksi')
    .setDescription("Liat semua yang pernah lo temuin")
    .addUserOption((o) => o.setName('orang').setDescription('Koleksi siapa yang mau diliat')) as SlashCommandBuilder,

  executeSlash: async (interaction: ChatInputCommandInteraction) => {
    if (!(await diArena(interaction))) return;
    const orang = (interaction.options.getMember('orang') as GuildMember | null) ?? interaction.member;
    const target = orang as GuildMember;
    const arkaUser = await getArkaUser(target.id);
    const koleksi: Record<string, number> = (arkaUser.koleksi as any) ?? {};
    if (Object.keys(koleksi).length === 0) {
      await interaction.reply({
        content: `${target.displayName} belum pernah jelajah pantai. Coba \`/hunt\`.`,
        ephemeral: true
      });
      return;
    }
    const baris = HUNT_TANGKAPAN.map(([nama, emoji]) => {
      const jumlah = koleksi[nama] ?? 0;
      return jumlah ? `${emoji}  **${nama}** × ${jumlah}` : `⬛  ~~${nama}~~`;
    });
    const isi = new EmbedBuilder()
      .setColor(WARNA)
      .setTitle(`🏖️  Koleksi ${target.displayName}`)
      .setDescription(baris.join('\n'));
    const kurang = HUNT_TANGKAPAN.length - Object.keys(koleksi).length;
    isi.setFooter({
      text:
        `${Object.keys(koleksi).length} dari ${HUNT_TANGKAPAN.length} jenis ketemu · total ${Object.values(koleksi).reduce((a, b) => a + b, 0)} kali dapet\n` +
        (kurang === 0 ? 'Lengkap. Lencananya nempel di /level, pamer sana.' : `Kurang ${kurang} jenis lagi buat dapet lencana di /level`)
    });
    await interaction.reply({ embeds: [isi], ephemeral: true });
  }
};
