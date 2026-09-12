import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  Message,
  EmbedBuilder,
  ButtonInteraction
} from 'discord.js';
import { Command } from '../handler';
import { WARNA, AKI_MAKS_TANYA, AKI_HADIAH_MENANG, AKI_WAKTU } from '../config';
import { AKI_SIFAT, AKI_SUBJEK } from '../data/aki';
import { diArena, beriXp, catatMain, buatSesi, matikanSesi, perpanjangSesi, tombol, barisTombol } from '../gameCore';

function akiKandidat(jawaban: Record<string, boolean>): string[] {
  const hasil: string[] = [];
  for (const [nama, sifat] of Object.entries(AKI_SUBJEK)) {
    const punya = new Set(sifat);
    if (Object.entries(jawaban).every(([s, nilai]) => punya.has(s) === nilai)) {
      hasil.push(nama);
    }
  }
  return hasil;
}

function akiTanyaTerbaik(kandidat: string[], sudah: Set<string>): string | null {
  let terbaik: string | null = null;
  let skorTerbaik: number | null = null;
  for (const sifat of Object.keys(AKI_SIFAT)) {
    if (sudah.has(sifat)) continue;
    const ya = kandidat.filter((n) => AKI_SUBJEK[n].includes(sifat)).length;
    if (ya === 0 || ya === kandidat.length) continue;
    const skor = Math.abs(ya - kandidat.length / 2);
    if (skorTerbaik === null || skor < skorTerbaik) {
      terbaik = sifat;
      skorTerbaik = skor;
    }
  }
  return terbaik;
}

interface SesiAki {
  pemainId: string;
  jawaban: Record<string, boolean>;
  sudah: Set<string>;
  jumlah: number;
  sifatSekarang: string;
}

// sesi pertanyaan aktif & fase tebakan (bener/salah)
const sesiPertanyaan = new Map<string, SesiAki>();
const sesiTebakan = new Map<string, { pemainId: string; tebakan: string; jumlah: number }>();

function embedTanya(sesi: SesiAki): EmbedBuilder {
  const isi = new EmbedBuilder()
    .setColor(WARNA)
    .setTitle(`🧞  Pertanyaan ke-${sesi.jumlah}`)
    .setDescription(`## ${AKI_SIFAT[sesi.sifatSekarang]}`);
  isi.setFooter({ text: `Sisa ${akiKandidat(sesi.jawaban).length} kemungkinan di kepala gua` });
  return isi;
}

function barisYaEngga(sesiId: string) {
  return barisTombol(
    tombol('Ya', '✅', sesiId, 'ya', 'Success'),
    tombol('Engga', '❌', sesiId, 'engga', 'Danger'),
    tombol('Ga tau', '🤷', sesiId, 'gatau')
  );
}

export const akinatorCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('akinator')
    .setDescription('Pikirin satu benda atau hewan, gua tebak') as SlashCommandBuilder,

  executeSlash: async (interaction: ChatInputCommandInteraction) => {
    if (!(await diArena(interaction))) return;

    const sesi: SesiAki = { pemainId: interaction.user.id, jawaban: {}, sudah: new Set(), jumlah: 1, sifatSekarang: '' };
    const kandidat = Object.keys(AKI_SUBJEK);
    const sifatAwal = akiTanyaTerbaik(kandidat, new Set());
    if (!sifatAwal || !(sifatAwal in AKI_SIFAT)) {
      await interaction.reply({ content: 'Sifat buat nebak lagi abis. Coba lagi lain kali.', ephemeral: true });
      return;
    }
    sesi.sifatSekarang = sifatAwal;

    async function tanyaLanjut(btn: ButtonInteraction, s: SesiAki, sesiId: string): Promise<void> {
      const kandidatBaru = akiKandidat(s.jawaban);
      if (kandidatBaru.length === 1) {
        await mulaiTebak(btn, s, sesiId, kandidatBaru[0], undefined);
        return;
      }
      if (kandidatBaru.length === 0) {
        await nyerah(btn, s, sesiId, 'Ga ada yang cocok sama jawaban lo. Lo mikirin sesuatu yang belum gua kenal.');
        return;
      }
      const sifatBaru = akiTanyaTerbaik(kandidatBaru, s.sudah);
      if (sifatBaru === null || s.jumlah >= AKI_MAKS_TANYA) {
        await mulaiTebak(
          btn,
          s,
          sesiId,
          kandidatBaru[Math.floor(Math.random() * kandidatBaru.length)],
          kandidatBaru
        );
        return;
      }
      s.sifatSekarang = sifatBaru;
      s.jumlah += 1;
      await btn.update({ embeds: [embedTanya(s)], components: barisYaEngga(sesiId) });
    }

    async function mulaiTebak(
      btn: ButtonInteraction,
      s: SesiAki,
      sesiId: string,
      nama: string,
      kandidatSaatIni: string[] | undefined
    ): Promise<void> {
      // sesi tetap hidup buat fase bener/salah, timer direset 60 detik
      perpanjangSesi(sesiId, 60);
      sesiTebakan.set(sesiId, { pemainId: s.pemainId, tebakan: nama, jumlah: s.jumlah });
      const rows = barisTombol(tombol('Bener!', '🎯', sesiId, 'bener', 'Success'), tombol('Salah', '🙅', sesiId, 'salah', 'Danger'));
      // sesi tetap hidup buat fase bener/salah — daftarin ulang tanpa timer lama
      const isi = new EmbedBuilder()
        .setColor(WARNA)
        .setTitle('🧞  Gua tau!')
        .setDescription(`Yang lo pikirin itu... **${nama}**?`);
      isi.setFooter({
        text:
          `Ketebak dalam ${s.jumlah} pertanyaan` +
          (kandidatSaatIni && kandidatSaatIni.length > 1 ? ` · sempet ada ${kandidatSaatIni.length} kemungkinan` : '')
      });
      await btn.update({ embeds: [isi], components: rows });
    }

    async function nyerah(btn: ButtonInteraction, s: SesiAki, sesiId: string, alasan: string): Promise<void> {
      matikanSesi(sesiId);
      sesiPertanyaan.delete(sesiId);
      const isi = new EmbedBuilder().setColor(WARNA).setTitle('🧞  Gua nyerah').setDescription(alasan);
      isi.setFooter({ text: 'Menang lo. Ajarin gua lain kali.' });
      await btn.update({ embeds: [isi], components: [] });
      await beriXp(btn.client, btn.guild, s.pemainId, AKI_HADIAH_MENANG);
    }

    const sesiId = buatSesi(async (btn, aksi) => {
      const s = sesiPertanyaan.get(sesiId!);

      // fase bener/salah setelah gua nebak
      if (aksi === 'bener' || aksi === 'salah') {
        const t = sesiTebakan.get(sesiId!);
        if (!t) return;
        if (btn.user.id !== t.pemainId) {
          await btn.reply({ content: 'Ini sesi orang lain.', ephemeral: true });
          return;
        }
        matikanSesi(sesiId!);
        sesiTebakan.delete(sesiId!);
        if (aksi === 'bener') {
          const isi = new EmbedBuilder()
            .setColor(WARNA)
            .setTitle('🧞  Gua menang')
            .setDescription(`**${t.tebakan}**. Cuma butuh **${t.jumlah} pertanyaan**.\nCoba lagi, bikin yang susah.`);
          await btn.update({ embeds: [isi], components: [] });
          await catatMain(t.pemainId, 'akinator');
        } else {
          const isi = new EmbedBuilder()
            .setColor(WARNA)
            .setTitle('🧞  Yah, meleset')
            .setDescription(
              `Gua kira **${t.tebakan}**. Ternyata bukan.\nNih **${AKI_HADIAH_MENANG} XP** buat lo, lo lebih pinter dari gua kali ini.`
            );
          await btn.update({ embeds: [isi], components: [] });
          await catatMain(t.pemainId, 'akinator', true);
          await beriXp(btn.client, btn.guild, t.pemainId, AKI_HADIAH_MENANG);
        }
        return;
      }

      if (!s) {
        await btn.reply({ content: 'Sesi ini udah habis.', ephemeral: true }).catch(() => {});
        return;
      }
      if (btn.user.id !== s.pemainId) {
        await btn.reply({ content: 'Ini sesi orang lain.', ephemeral: true });
        return;
      }

      if (aksi !== 'gatau') {
        s.jawaban[s.sifatSekarang] = aksi === 'ya';
      }
      s.sudah.add(s.sifatSekarang);
      await tanyaLanjut(btn, s, sesiId!);
    }, AKI_WAKTU);

    sesiPertanyaan.set(sesiId, sesi);

    await interaction.reply({
      content: `${interaction.user} pikirin satu **hewan atau benda sehari hari**, jangan dikasih tau. Gua tebak dalam ${AKI_MAKS_TANYA} pertanyaan.`,
      embeds: [embedTanya(sesi)],
      components: barisYaEngga(sesiId)
    });
  }
};
