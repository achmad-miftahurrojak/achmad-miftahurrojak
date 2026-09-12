import * as fs from 'fs';
import * as path from 'path';
import { PrismaClient } from '@hamin/database';
import { logger } from '@hamin/utils';

const prisma = new PrismaClient();

async function run() {
  const dataPath = path.join(process.cwd(), '..', '..', 'data', 'data-arka.json');
  if (!fs.existsSync(dataPath)) {
    logger.error('data-arka.json not found');
    return;
  }

  const raw = fs.readFileSync(dataPath, 'utf-8');
  const data = JSON.parse(raw);

  const { orang, global: globalData } = data;

  // Migrate global data
  if (globalData) {
    const cuacaTanggal = globalData.cuaca_tanggal;
    const cuacaNama = globalData.cuaca_nama;
    const cuacaKali = globalData.cuaca_kali;
    const cuacaEmoji = globalData.cuaca_emoji;
    const cuacaKata = globalData.cuaca_kata;
    const cuacaDiumumkan = globalData.cuaca_diumumkan;
    const petKenyang = globalData.pet_kenyang;
    const petTerakhir = globalData.pet_terakhir ? new Date(globalData.pet_terakhir) : new Date();
    const season = globalData.season;
    
    await prisma.arkaGlobal.upsert({
      where: { id: 1 },
      create: {
        id: 1,
        cuacaTanggal,
        cuacaNama,
        cuacaKali,
        cuacaEmoji,
        cuacaKata,
        cuacaDiumumkan,
        petKenyang,
        petTerakhir,
        season,
        misi: globalData.misi,
        quest: globalData.quest,
        misiKemarinDaftar: globalData.misi_kemarin_daftar,
        lombaAcara: globalData.lomba_acara,
        toko: globalData.toko,
        rantai: globalData.rantai,
        kapsul: globalData.kapsul,
        kapsulTerakhir: globalData.kapsul_terakhir,
        seasonData: globalData.season_data,
        rekapTerakhir: globalData.rekap_terakhir,
        rekapGiliran: globalData.rekap_giliran,
        petNama: globalData.pet_nama,
        petTotalMakan: globalData.pet_total_makan
      },
      update: {
        cuacaTanggal,
        cuacaNama,
        cuacaKali,
        cuacaEmoji,
        cuacaKata,
        cuacaDiumumkan,
        petKenyang,
        petTerakhir,
        season,
        misi: globalData.misi,
        quest: globalData.quest,
        misiKemarinDaftar: globalData.misi_kemarin_daftar,
        lombaAcara: globalData.lomba_acara,
        toko: globalData.toko,
        rantai: globalData.rantai,
        kapsul: globalData.kapsul,
        kapsulTerakhir: globalData.kapsul_terakhir,
        seasonData: globalData.season_data,
        rekapTerakhir: globalData.rekap_terakhir,
        rekapGiliran: globalData.rekap_giliran,
        petNama: globalData.pet_nama,
        petTotalMakan: globalData.pet_total_makan
      }
    });
    logger.info('Migrated global data');
  }

  // Migrate users
  if (orang) {
    let count = 0;
    for (const [userId, uData] of Object.entries<any>(orang)) {
      // Upsert User
      let absenTerakhir = null;
      if (uData.absen_terakhir) {
        absenTerakhir = new Date(uData.absen_terakhir);
      }
      
      await prisma.user.upsert({
        where: { id: userId },
        create: {
          id: userId,
          xp: uData.xp ?? 0,
          xpMinggu: uData.xp_minggu ?? 0,
          pesan: uData.pesan ?? 0,
          menit: uData.menit ?? 0,
          absen: uData.absen ?? 0,
          absenPanjang: uData.absen_panjang ?? 0,
          absenTerakhir,
          menang: uData.menang ?? 0,
          kalah: uData.kalah ?? 0,
          juara: uData.juara ?? 0
        },
        update: {
          xp: uData.xp ?? 0,
          xpMinggu: uData.xp_minggu ?? 0,
          pesan: uData.pesan ?? 0,
          menit: uData.menit ?? 0,
          absen: uData.absen ?? 0,
          absenPanjang: uData.absen_panjang ?? 0,
          absenTerakhir,
          menang: uData.menang ?? 0,
          kalah: uData.kalah ?? 0,
          juara: uData.juara ?? 0
        }
      });

      // Upsert GameStats
      if (uData.game && uData.game.duel) {
        await prisma.gameStats.upsert({
          where: { userId },
          create: {
            userId,
            duelMain: uData.game.duel.main ?? 0,
            duelMenang: uData.game.duel.menang ?? 0,
            duelMinggu: uData.game.duel.minggu ?? 0,
          },
          update: {
            duelMain: uData.game.duel.main ?? 0,
            duelMenang: uData.game.duel.menang ?? 0,
            duelMinggu: uData.game.duel.minggu ?? 0,
          }
        });
      }

      // Upsert ArkaUser
      await prisma.arkaUser.upsert({
        where: { userId },
        create: {
          userId,
          game: uData.game,
          misi: uData.misi,
          efek: uData.efek,
          barang: uData.barang,
          koleksi: uData.koleksi,
          misiMinggu: uData.misi_minggu,
          kasihHarian: uData.kasih_harian,
          kasihKe: uData.kasih_ke,
          misiKemarin: uData.misi_kemarin,
          wishlist: uData.wishlist,
          absenRiwayat: uData.absen_riwayat,
          petMakan: uData.pet_makan,
          xpAbadi: uData.xp_abadi ?? 0,
          terakhirAktif: uData.terakhir_aktif,
          hampirDikabarin: String(uData.hampir_dikabarin ?? '')
        },
        update: {
          game: uData.game,
          misi: uData.misi,
          efek: uData.efek,
          barang: uData.barang,
          koleksi: uData.koleksi,
          misiMinggu: uData.misi_minggu,
          kasihHarian: uData.kasih_harian,
          kasihKe: uData.kasih_ke,
          misiKemarin: uData.misi_kemarin,
          wishlist: uData.wishlist,
          absenRiwayat: uData.absen_riwayat,
          petMakan: uData.pet_makan,
          xpAbadi: uData.xp_abadi ?? 0,
          terakhirAktif: uData.terakhir_aktif,
          hampirDikabarin: String(uData.hampir_dikabarin ?? '')
        }
      });
      count++;
    }
    logger.info(`Migrated ${count} users`);
  }
}

run()
  .then(() => {
    console.log('Migration complete');
    process.exit(0);
  })
  .catch(err => {
    console.error('Migration failed', err);
    process.exit(1);
  });
