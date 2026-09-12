import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  Message,
  EmbedBuilder,
  ButtonInteraction,
  GuildMember,
  TextChannel
} from 'discord.js';
import { Command } from '../handler';
import {
  WARNA,
  DUEL_TARUHAN,
  DUEL_MIN,
  DUEL_MAKS,
  DUEL_DM,
  BALON_HADIAH,
  BALON_TUNGGU
} from '../config';
import { suara } from '../data/suara';
import {
  diArena,
  beriXp,
  catatMain,
  prisma,
  buatSesi,
  matikanSesi,
  tombol,
  barisTombol,
  pilih,
  tunggu,
  ambilBarang,
  simpanBarang,
  sesiAktif
} from '../gameCore';
import { majuMisi } from './misi';

const GAMBAR: Record<string, string> = { batu: '🪨', kertas: '📄', gunting: '✂️' };
const KALAH_DARI: Record<string, string> = { batu: 'gunting', kertas: 'batu', gunting: 'kertas' };
const PUTAR = ['🪨 . . .', '📄 . . .', '✂️ . . .'];

function hadiahKe(beruntun: number) {
  return 60 + Math.min(Math.max(beruntun, 1) - 1, 5) * 30;
}

async function ambilSuitBeruntun(userId: string): Promise<number> {
  const arkaUser = await prisma.arkaUser.upsert({ where: { userId }, create: { userId }, update: {} });
  return ((arkaUser.efek as any)?.suit_beruntun ?? 0) as number;
}

// ============================================================
// /suit — best of 3 lawan bot (port SuitPapan)
// ============================================================

interface PapanSuit {
  pemainId: string;
  ronde: number;
  skorKamu: number;
  skorAku: number;
  riwayat: string[];
}

const papanAktif = new Map<string, PapanSuit>(); // sesi -> papan

async function papanEmbed(inter: ChatInputCommandInteraction | ButtonInteraction, sesi: string, judul: string, bawah = '') {
  const papan = papanAktif.get(sesi)!;
  const beruntun = await ambilSuitBeruntun(papan.pemainId);
  const embed = new EmbedBuilder().setColor(WARNA).setTitle(judul).setDescription(bawah);
  embed.addFields(
    {
      name: 'Skor pertandingan ini',
      value: `Lo **${papan.skorKamu}**  —  **${papan.skorAku}** gua\nmenang 2 duluan`,
      inline: true
    },
    {
      name: 'Kalau menang',
      value:
        `**${hadiahKe(beruntun + 1).toLocaleString()} XP**` +
        (beruntun ? `\nberuntun jadi ${beruntun + 1}x` : ''),
      inline: true
    },
    {
      name: 'Beruntun sekarang',
      value:
        (beruntun ? '🔥 ' : '') +
        (beruntun ? `**${beruntun}** pertandingan` : 'belum ada, ini yang pertama'),
      inline: true
    }
  );
  if (papan.riwayat.length > 0) {
    embed.addFields({
      name: 'Ronde yang udah jalan',
      value: papan.riwayat.join('  ') + '   🟢 lo menang · 🔴 gua menang · 🟡 seri',
      inline: false
    });
  }
  return embed;
}

async function suitSelesai(inter: ButtonInteraction, sesi: string, judul: string, hasil: string) {
  const papan = papanAktif.get(sesi)!;
  const userId = papan.pemainId;
  let beruntun = await ambilSuitBeruntun(userId);
  const arkaUser = await prisma.arkaUser.upsert({ where: { userId }, create: { userId }, update: {} });
  const efek: any = (arkaUser.efek as any) ?? {};
  const barang = await ambilBarang(userId);
  let akhir = '';

  if (papan.skorKamu > papan.skorAku) {
    beruntun += 1;
    efek.suit_beruntun = beruntun;
    await prisma.user.update({ where: { id: userId }, data: { menang: { increment: 1 } } }).catch(async () => {
      await prisma.user.upsert({ where: { id: userId }, create: { id: userId }, update: {} });
      await prisma.user.update({ where: { id: userId }, data: { menang: { increment: 1 } } });
    });
    await catatMain(userId, 'suit', true);
    const hadiah = hadiahKe(beruntun);
    akhir = `**Pertandingan selesai ${papan.skorKamu}\u2013${papan.skorAku}, lo yang menang.** Ambil **${hadiah.toLocaleString()} XP**.`;
    if (beruntun >= 2) {
      const lanjut = hadiahKe(beruntun + 1);
      akhir += `\n🔥 Ini kemenangan beruntun ke-**${beruntun}**. Menang lagi dapet **${lanjut.toLocaleString()} XP**.`;
    } else {
      akhir += `\nMenang lagi tanpa kalah, hadiahnya naik jadi **${hadiahKe(2).toLocaleString()} XP**.`;
    }
    await majuMisi(userId, 'suit', 1, inter.client);
    await beriXp(inter.client, inter.guild, userId, hadiah);
  } else {
    await prisma.user.update({ where: { id: userId }, data: { kalah: { increment: 1 } } }).catch(async () => {
      await prisma.user.upsert({ where: { id: userId }, create: { id: userId }, update: {} });
      await prisma.user.update({ where: { id: userId }, data: { kalah: { increment: 1 } } });
    });
    await catatMain(userId, 'suit');
    akhir = `**Pertandingan selesai ${papan.skorKamu}\u2013${papan.skorAku}, gua yang menang.**`;
    if (beruntun >= 1 && (barang.perisai ?? 0) > 0) {
      barang.perisai -= 1;
      if (!barang.perisai) delete barang.perisai;
      akhir += `\n🛡️ **Perisai Beruntun kepakai.** Runtutan **${beruntun}** lo selamat. Sisa perisai: ${barang.perisai ?? 0}.`;
    } else {
      efek.suit_beruntun = 0;
      if (beruntun >= 2) {
        akhir += `\n💀 Runtutan **${beruntun} pertandingan** lo putus di sini. Balik ke 60 XP lagi.`;
      }
    }
  }

  await simpanBarang(userId, barang);
  await prisma.arkaUser.update({ where: { userId }, data: { efek } as any });
  matikanSesi(sesi);
  papanAktif.delete(sesi);

  const embed = await papanEmbed(inter, sesi, judul, hasil + '\n\n' + akhir);
  // semua tombol mati: bikin ulang baris dengan disabled
  const rows = barisTombol(
    tombol('Batu', '🪨', sesi, 'batu', 'Secondary', true),
    tombol('Kertas', '📄', sesi, 'kertas', 'Secondary', true),
    tombol('Gunting', '✂️', sesi, 'gunting', 'Secondary', true)
  );
  await inter.update({ embeds: [embed], components: rows });
}

async function suitMain(inter: ButtonInteraction, sesi: string, kamu: string) {
  const papan = papanAktif.get(sesi)!;
  if (inter.user.id !== papan.pemainId) {
    await inter.reply({ content: 'Ini suitnya orang lain. Ketik `/suit` buat mulai punya lo.', ephemeral: true });
    return;
  }
  await inter.update({
    embeds: [await papanEmbed(inter, sesi, `${GAMBAR[kamu]}  lawan  ${PUTAR[0]}`)]
  });
  for (const bingkai of PUTAR.slice(1)) {
    await tunggu(0.7);
    await inter.editReply({ embeds: [await papanEmbed(inter, sesi, `${GAMBAR[kamu]}  lawan  ${bingkai}`)] });
  }
  const aku = pilih(Object.keys(GAMBAR));
  await tunggu(0.5);
  let hasil: string;
  let tanda: string;
  if (kamu === aku) {
    hasil = 'Seri, ronde ini ga dihitung.';
    tanda = '🟡';
  } else if (KALAH_DARI[kamu] === aku) {
    papan.skorKamu += 1;
    hasil = 'Ronde ini lo yang menang.';
    tanda = '🟢';
  } else {
    papan.skorAku += 1;
    hasil = 'Ronde ini gua yang menang.';
    tanda = '🔴';
  }
  papan.riwayat.push(tanda);
  const judul = `${GAMBAR[kamu]}  lawan  ${GAMBAR[aku]}`;
  const selesai = papan.skorKamu === 2 || papan.skorAku === 2;
  if (!selesai) {
    if (tanda !== '🟡') papan.ronde += 1;
    await inter.editReply({
      embeds: [await papanEmbed(inter, sesi, judul, hasil + ' Lanjut, pilih lagi.')]
    });
    return;
  }
  await suitSelesai(inter, sesi, judul, hasil);
}

export const suitCommand: Command = {
  data: new SlashCommandBuilder().setName('suit').setDescription('Suit best of 3 lawan Arka') as SlashCommandBuilder,

  executeSlash: async (interaction: ChatInputCommandInteraction) => {
    if (!(await diArena(interaction))) return;
    const userId = interaction.user.id;
    const sesi = buatSesi((btn, aksi) => suitMain(btn, sesi!, aksi), 90);
    papanAktif.set(sesi, {
      pemainId: userId,
      ronde: 1,
      skorKamu: 0,
      skorAku: 0,
      riwayat: []
    });
    const beruntun = await ambilSuitBeruntun(userId);
    let pembuka =
      'Siapa yang **menang 2 ronde duluan**, dia menang pertandingan. Kalau 2–0, ronde ketiga ga usah dimainin.';
    if (beruntun >= 2) pembuka += `\n\n🔥 Lo lagi beruntun **${beruntun} pertandingan**. Kalah sekali, hangus semua.`;
    const embed = await papanEmbed(interaction, sesi, '✂️  Suit — Ronde 1', pembuka);
    await interaction.reply({
      embeds: [embed],
      components: barisTombol(
        tombol('Batu', '🪨', sesi, 'batu'),
        tombol('Kertas', '📄', sesi, 'kertas'),
        tombol('Gunting', '✂️', sesi, 'gunting')
      )
    });
  }
};

// ============================================================
// /duel — tantang member lain (port DuelTerima + DuelSerang)
// ============================================================

interface SesiDuel {
  penantangId: string;
  lawanId: string;
  taruhan: number;
  fase: 'terima' | 'serang' | 'selesai';
  pesan?: any;
}

const duelJalan = new Map<string, SesiDuel>();

export const duelCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('duel')
    .setDescription('Tantang member lain, adu cepat rebut XP')
    .addUserOption((o) => o.setName('lawan').setDescription('Siapa yang mau ditantang').setRequired(true))
    .addIntegerOption(
      (o) =>
        o
          .setName('taruhan')
          .setDescription(`XP yang dipertaruhin, ${DUEL_MIN} sampai ${DUEL_MAKS}`)
          .setMinValue(DUEL_MIN)
          .setMaxValue(DUEL_MAKS)
    ) as SlashCommandBuilder,

  executeSlash: async (interaction: ChatInputCommandInteraction) => {
    if (!(await diArena(interaction))) return;
    const lawan = interaction.options.getMember('lawan') as GuildMember | null;
    const taruhan = interaction.options.getInteger('taruhan') ?? DUEL_TARUHAN;
    if (!lawan || lawan.user.bot || lawan.id === interaction.user.id) {
      await interaction.reply({ content: 'Cari lawan yang bener.', ephemeral: true });
      return;
    }
    const userKamu = await prisma.user.upsert({ where: { id: interaction.user.id }, create: { id: interaction.user.id }, update: {} });
    const userLawan = await prisma.user.upsert({ where: { id: lawan.id }, create: { id: lawan.id }, update: {} });
    if (userKamu.xp < taruhan || userLawan.xp < taruhan) {
      const kurang = userKamu.xp < taruhan ? interaction.user.displayName : lawan.displayName;
      await interaction.reply({
        content: `Taruhan ${taruhan.toLocaleString()} XP kegedean. **${kurang}** ga punya sebanyak itu.`,
        ephemeral: true
      });
      return;
    }

    const sesiDuel: SesiDuel = {
      penantangId: interaction.user.id,
      lawanId: lawan.id,
      taruhan,
      fase: 'terima'
    };
    const sesi = buatSesi(async (btn, aksi) => {
      const d = duelJalan.get(sesi!)!;
      if (d.fase === 'terima') {
        if (btn.user.id !== d.lawanId) {
          await btn.reply({ content: 'Bukan lo yang ditantang.', ephemeral: true });
          return;
        }
        if (aksi === 'kabur') {
          d.fase = 'selesai';
          matikanSesi(sesi!);
          duelJalan.delete(sesi!);
          await btn.update({ content: `🏃 ${lawan.displayName} kabur. ${interaction.user.displayName} menang tanpa keringetan, tapi ga dapet XP.`, components: [] });
          return;
        }
        d.fase = 'serang';
        await btn.update({ content: '⚔️ Duel diterima. **3...**' });
        for (const angka of ['2', '1']) {
          await tunggu(1);
          await btn.editReply({ content: `⚔️ Duel diterima. **${angka}...**` });
        }
        await btn.editReply({ content: '⚔️ Siap siap...' });
        await tunggu(1.5 + Math.random() * 3.5);
        d.fase = 'serang';
        await btn.editReply({
          content: '🌊 **SERANG SEKARANG!**',
          components: barisTombol(tombol('SERANG!', '🌊', sesi!, 'serang', 'Danger'))
        });
        return;
      }
      if (d.fase === 'serang') {
        if (btn.user.id !== d.penantangId && btn.user.id !== d.lawanId) {
          await btn.reply({ content: 'Ini duel orang lain, jangan ikut campur.', ephemeral: true });
          return;
        }
        d.fase = 'selesai';
        matikanSesi(sesi!);
        duelJalan.delete(sesi!);
        const menangId = btn.user.id;
        const kalahId = menangId === d.penantangId ? d.lawanId : d.penantangId;
        const menang = menangId === d.penantangId ? interaction.user : lawan;
        const kalah = menangId === d.penantangId ? lawan : interaction.user;
        await catatMain(menangId, 'duel', true);
        await catatMain(kalahId, 'duel');
        await prisma.user.update({ where: { id: menangId }, data: { menang: { increment: 1 } } }).catch(() => {});
        await prisma.user.update({ where: { id: kalahId }, data: { kalah: { increment: 1 } } }).catch(() => {});
        const { ubahXpLangsung } = await import('../gameCore');
        await ubahXpLangsung(menangId, d.taruhan);
        await ubahXpLangsung(kalahId, -d.taruhan);
        await majuMisi(menangId, 'duel', 1, btn.client);
        await btn.update({
          content: suara('duel_selesai', { a: menang.displayName, b: kalah.displayName, x: d.taruhan.toLocaleString() }),
          components: []
        });
      }
    }, 120);

    duelJalan.set(sesi, sesiDuel);

    await interaction.reply({
      content:
        suara('duel_mulai', {
          a: interaction.user.toString(),
          b: lawan.toString(),
          x: taruhan.toLocaleString()
        }) + `\n${lawan}, berani ga?`,
      components: barisTombol(
        tombol('Terima', '⚔️', sesi, 'terima', 'Success'),
        tombol('Kabur', '🏃', sesi, 'kabur')
      )
    });

    if (DUEL_DM) {
      try {
        const pesan = await interaction.fetchReply();
        const kabar = new EmbedBuilder()
          .setColor(WARNA)
          .setTitle('⚔️  Lo ditantang duel')
          .setDescription(
            `**${interaction.user.displayName}** nantangin lo di **${interaction.guild?.name}**.\nTaruhannya **${taruhan.toLocaleString()} XP**.`
          )
          .addFields({ name: 'Buruan', value: `Tantangannya cuma nunggu **60 detik**.\n[Buka tantangannya](${pesan.url})` });
        await lawan.send({ embeds: [kabar] });
      } catch {
        await interaction.followUp({
          content: `DM ${lawan.displayName} ketutup, jadi dia cuma kekabarin lewat mention di sini.`,
          ephemeral: true
        });
      }
    }
  }
};

// ============================================================
// /balon — perang balon air (port BalonAir)
// ============================================================

const balonJalan = new Set<string>();

export const balonCommand: Command = {
  data: new SlashCommandBuilder().setName('balon').setDescription('Perang balon air, adu cepet mencet') as SlashCommandBuilder,

  executeSlash: async (interaction: ChatInputCommandInteraction) => {
    if (!(await diArena(interaction))) return;
    if (balonJalan.has(interaction.channelId)) {
      await interaction.reply({ content: 'Masih ada ronde jalan, tunggu bentar.', ephemeral: true });
      return;
    }
    balonJalan.add(interaction.channelId);
    try {
      await interaction.reply(suara('balon_siap'));
      const pesan = await interaction.fetchReply();
      await tunggu(BALON_TUNGGU[0] + Math.random() * (BALON_TUNGGU[1] - BALON_TUNGGU[0]));
      const sesi = buatSesi(async (btn) => {
        matikanSesi(sesi!);
        await catatMain(btn.user.id, 'balon');
        await prisma.user.update({ where: { id: btn.user.id }, data: { menang: { increment: 1 } } }).catch(async () => {
          await prisma.user.upsert({ where: { id: btn.user.id }, create: { id: btn.user.id }, update: {} });
          await prisma.user.update({ where: { id: btn.user.id }, data: { menang: { increment: 1 } } });
        });
        await majuMisi(btn.user.id, 'balon', 1, btn.client);
        await beriXp(btn.client, btn.guild, btn.user.id, BALON_HADIAH);
        await btn.update({
          content: suara('balon_menang', { a: btn.user.displayName, x: BALON_HADIAH }),
          components: []
        });
      }, 25);

      await interaction.editReply({
        content: '💦 **SEKARANG!** Cepetan mencet!',
        components: barisTombol(tombol('LEMPAR!', '💦', sesi, 'lempar', 'Primary'))
      });

      // nunggu sesi selesai atau timeout
      const mulai = Date.now();
      while (sesiAktifAda(sesi) && Date.now() - mulai < 26000) {
        await tunggu(1);
      }
      if (sesiAktifAda(sesi)) {
        matikanSesi(sesi);
        await pesan.edit({ components: [] }).catch(() => {});
        await interaction.followUp(suara('balon_sepi'));
      }
    } finally {
      balonJalan.delete(interaction.channelId);
    }
  }
};

function sesiAktifAda(sesi: string): boolean {
  return (sesiAktif as Map<string, unknown>).has(sesi);
}
