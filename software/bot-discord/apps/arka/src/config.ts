// ============================================================
// ARKA BOT - Config (port dari cogs/arka/config.py)
// ============================================================

export const WARNA = 0x4aa8d8;

// --- XP Tingkat ---
export const TINGKAT = [
  [0, 'Shoreline', null],
  [300, 'Shallows', 'Shallows'],
  [900, 'Reef', 'Reef'],
  [2000, 'Open Sea', 'Open Sea'],
  [4000, 'Deep Current', 'Deep Current'],
  [7500, 'The Trench', 'The Trench']
] as const;

// --- Cuaca ---
export const CUACA = [
  ['Air Tenang', 1.0, '???', 'Hari biasa. Santai aja.'],
  ['Air Tenang', 1.0, '???', 'Ga ada yang istimewa hari ini.'],
  ['Angin Segar', 1.5, '???', 'Anginnya enak, XP naik satu setengah kali.'],
  ['Ombak Besar', 2.0, '??', 'OMBAK BESAR! XP dobel seharian!'],
  ['Kabut', 0.8, '???', 'Kabut tebal, semuanya jadi lambat.'],
  ['Badai', 3.0, '??', 'BADAI! XP tiga kali lipat, tapi cuma hari ini!']
] as const;

// --- Pet ---
export const PET_SUASANA = [
  [80, 'riang', '??', 1.15],
  [50, 'biasa aja', '??', 1.0],
  [25, 'lesu', '??', 0.95],
  [0, 'kelaparan', '??', 0.9]
] as const;

export const PET_AKTIF = true;
export const PET_NAMA = 'Nemo';
export const PET_LAPAR_PER_JAM = 4;
export const PET_HARGA_MAKAN = 50;
export const PET_ISI_MAKAN = 20;
export const PET_MAKAN_MAKS_HARIAN = 3;

// --- Comeback ---
export const COMEBACK_AKTIF = true;
export const COMEBACK_HARI = 14;
export const COMEBACK_XP = 500;
export const COMEBACK_PENGALI = 1.5;
export const COMEBACK_JAM = 24;

// --- Notifikasi ---
export const KABAR_HAMPIR = true;
export const HAMPIR_AMBANG = 100;

// --- Buff Paus ---
export const PAUS_TAMBAHAN = 0.5;

// --- Lencana ---
export const LENCANA = [
  ['ngobrol', '??', 'Tukang Ngobrol', 'Kirim 500 pesan', 'pesan', 500],
  ['suara', '???', 'Betah di Voice', 'Nongkrong 600 menit', 'menit', 600],
  ['rajin', '??', 'Ga Pernah Bolos', 'Absen 14 hari beruntun', 'absenPanjang', 14],
  ['jawara', '??', 'Jawara', 'Menang 50 kali', 'menang', 50],
  ['juara', '??', 'Penguasa Ombak', 'Juara mingguan 3 kali', 'juara', 3]
] as const;

// --- Season ---
export const SEASON_AKTIF = true;
export const SEASON_BULAN = 3;
export const SEASON_JUARA_DISIMPAN = 5;
export const SEASON_SISA_PERSEN = 0.5;

// --- Rantai Kata ---
export const RANTAI_HURUF_MIN = 3;
export const RANTAI_XP = 5;
export const RANTAI_XP_REKOR = 10;

// --- Kapsul Waktu ---
export const KAPSUL_AKTIF = true;
export const KAPSUL_HARI_MIN = 7;
export const KAPSUL_HARI_MAKS = 365;
export const KAPSUL_MAKS_PER_ORANG = 3;
export const KAPSUL_JAM_BUKA = 8;

// --- Kasih XP ---
export const KASIH_AKTIF = true;
export const KASIH_MIN = 10;
export const KASIH_MAKS_HARIAN = 500;
export const KASIH_POTONGAN = 0.1;

// --- Kasih Item ---
export const KASIH_ITEM_AKTIF = true;
export const KASIH_ITEM_HARIAN = 5;
export const KASIH_ITEM_DILARANG = ['paus'];

// --- Wishlist ---
export const WISHLIST_AKTIF = true;
export const WISHLIST_MAKS = 5;

// --- Julukan ---
export const JULUKAN_HARI = 14;

// --- Toko ---
export const TOKO_SUPER_PELUANG = 0.3;
export const TOKO_SUPER = ['paus'];
export const TOKO_KELOMPOK: Record<string, [string[], number]> = {
  dasar: [['kerang', 'kail', 'umpan'], 3],
  menengah: [['cepat', 'lumba', 'perisai'], 2],
  premium: [['tiket', 'julukan', 'namapet'], 1]
};
export const BATAS_BELI: Record<string, number> = {
  paus: 2,
  namapet: 1
};

export const BARANG: [string, string, string, number, string][] = [
  ['kerang', '??', 'Kerang Ajaib', 300, 'Ganti satu misi harian yang ga sreg.'],
  ['kail', '??', 'Kail Perak', 450, 'Tangkapan di /hunt jadi lebih gede.'],
  ['umpan', '??', 'Umpan Emas', 500, 'Dobel jelajah di /hunt selama 3 kali.'],
  ['cepat', '?', 'Air Pasang', 600, 'Cooldown /hunt jadi nol selama 30 menit.'],
  ['lumba', '??', 'Sahabat Lumba lumba', 700, 'Misi kemarin yang ga kelar dibayar setengah pas lo /misi besoknya.'],
  ['perisai', '???', 'Perisai Beruntun', 800, 'Lindungi streak absen lo dari satu hari bolos.'],
  ['tiket', '???', 'Tiket Kapal', 1000, 'Ikut lomba berbayar tanpa bayar XP.'],
  ['paus', '??', 'Paus Raksasa', 1500, 'XP naik 50 persen selama 24 jam. Langsung aktif, ga masuk tas.'],
  ['julukan', '???', 'Julukan Sendiri', 1200, 'Bikin role sendiri dengan nama dan warna sesuka lo, aktif 14 hari.'],
  ['namapet', '??', 'Hak Nama Nemo', 1800, 'Kasih nama baru buat peliharaan server. Satu kali pakai selamanya.']
];

export const JAM_CUACA = 7;
export const JAM_TOKO = 8;
export const JAM_MISI = 0;

export const MISI_JUMLAH = 3;
export const MISI_BONUS = 50;
export const MISI_DM = true;
export const MISI_MINGGU_HARI = 5;
export const MISI_MINGGU_XP = 200;
export const MISI_PILIHAN: [string, string, number, number][] = [
  ['pesan', 'Kirimin {n} pesan di server', 10, 30],
  ['pesan', 'Ngobrol {n} kali', 20, 50],
  ['menit', 'Nongkrong {n} menit di voice', 15, 40],
  ['menit', 'Habiskan {n} menit di voice', 30, 70],
  ['menang', 'Menang {n} kali di mini game', 1, 25],
  ['menang', 'Kalahkan orang lain {n} kali', 3, 60],
  ['absen', 'Absen {n} hari beruntun', 1, 20],
  ['rantai', 'Ikut rantai kata {n} kali', 3, 35],
  ['hunt', 'Jelajahi laut {n} kali', 2, 40],
  ['trivia', 'Jawab {n} soal trivia bener', 3, 50]
];

export const QUEST_AKTIF = true;
export const QUEST_BONUS = 100;
export const QUEST_PILIHAN: [string, string, number][] = [
  ['pesan', 'Server ngobrol {n} kali bareng-bareng', 200],
  ['menang', 'Semua orang gabungan menang {n} kali', 50],
  ['rantai', 'Rantai kata tembus {n} kata', 30],
  ['hunt', 'Jelajahi laut {n} kali bareng-bareng', 40]
];

export const TANGKAPAN: [string, string, string, number, number, number][] = [
  ['sampah', '??', 'Sepatu Bolong', 40, 0, 0],
  ['teri', '??', 'Ikan Teri', 30, 5, 10],
  ['kakap', '??', 'Ikan Kakap', 15, 15, 25],
  ['cumi', '??', 'Cumi Raksasa', 8, 30, 50],
  ['kura', '??', 'Kura-kura', 5, 50, 80],
  ['duyung', '??', 'Putri Duyung', 2, 100, 150]
];

export const ROLE_SOAL: string[] = ['Island Owner'];

// ============================================================
// Port konstanta game dari cogs/arka/config.py
// Catatan: semua snowflake ID disimpan sebagai string (aman di JS)
// ============================================================

export const CHANNEL_ARENA = process.env.ARKA_CHANNEL_ARENA || '1535810881634570372';
export const CHANNEL_REKAP = process.env.ARKA_CHANNEL_REKAP || '1535836590264557599';
export const CHANNEL_STATISTIK = process.env.ARKA_CHANNEL_STATISTIK || '1535960574263820338';
export const CHANNEL_QUEST = process.env.ARKA_CHANNEL_QUEST || '1535918526156767242';

// Nilai 'semua' = boleh di channel mana saja, [] / tidak ada = default arena
export const CHANNEL_PERINTAH: Record<string, string[] | 'semua' | undefined> = {
  trivia: ['1535917622036791367'],
  lagu: ['1535919887673856073'],
  tambahlagu: ['1535919887673856073'],
  akinator: ['1535917843965550692'],
  turnamen: ['1535967723836940379'],
  balon: ['1535920221884518452'],
  lomba: ['1535920856658874460'],
  lombatutup: ['1535920856658874460'],
  acara: ['1535919366426730506', '1535921034891628645'],
  acaralist: ['1535919366426730506', '1535921034891628645'],
  acarahapus: ['1535919366426730506', '1535921034891628645'],
  acaraedit: ['1535919366426730506', '1535921034891628645'],
  backup: 'semua',
  hunt: ['1535916648765063300'],
  koleksi: ['1535916648765063300'],
  duel: ['1535968024937500722'],
  tebak: ['1535967600520073306'],
  suit: ['1535967723836940379'],
  panduan: 'semua',
};

// --- Tebak ---
export const TEBAK_MAKS = 100;
export const TEBAK_KESEMPATAN = 7;

// --- Duel ---
export const DUEL_TARUHAN = 50;
export const DUEL_MIN = 10;
export const DUEL_MAKS = 5000;
export const DUEL_DM = true;

// --- Balon ---
export const BALON_HADIAH = 90;
export const BALON_TUNGGU: [number, number] = [3, 9];

// --- Trivia ---
export const TRIVIA_WAKTU = 35;
export const TRIVIA_PETUNJUK = 18;
export const TRIVIA_HADIAH = 80;
export const TRIVIA_CEPAT = 40;
export const TRIVIA_JEDA_ORANG = 30;
export const WAKTU_KATEGORI: Record<string, [number, number, number, number]> = {
  hots: [90, 45, 130, 70]
};

// --- Hunt ---
export const HUNT_JEDA = 300;
export const KAIL_PENGALI = 3;
export const CEPAT_JEDA = 60;
export const CEPAT_LAMA = 60;
export const HUNT_TANGKAPAN: [string, string, number, number][] = [
  ['sandal jepit sebelah', '🩴', 18, 5],
  ['botol plastik', '🧴', 15, 5],
  ['kerang kecil', '🐚', 15, 20],
  ['ikan teri', '🐟', 14, 25],
  ['kepiting', '🦀', 12, 40],
  ['bintang laut', '⭐', 9, 55],
  ['ubur ubur', '🪼', 7, 60],
  ['gurita', '🐙', 5, 90],
  ['penyu', '🐢', 3, 150],
  ['botol berisi pesan', '📜', 1.5, 220],
  ['peti harta karun', '🧰', 0.5, 400]
];

// --- Lagu ---
export const LAGU_JEDA_TAHAP = 20;
export const LAGU_HADIAH = [150, 100, 60, 30];
export const LAGU_JEDA_ORANG = 30;

// --- Akinator ---
export const AKI_MAKS_TANYA = 12;
export const AKI_HADIAH_MENANG = 120;
export const AKI_WAKTU = 120;

// --- Turnamen ---
export const TURNAMEN_MIN = 2;
export const TURNAMEN_MAKS = 16;
export const TURNAMEN_DAFTAR_MENIT = 5;
export const TURNAMEN_PILIH_DETIK = 45;
export const TURNAMEN_HADIAH = [500, 250, 100];

// --- Lomba & Acara ---
export const LOMBA_HADIAH = [300, 150, 75];
export const ACARA_INGETIN = 10;
export const ACARA_DM = true;
export const EMOJI_IKUT = '✅';
export const EMOJI_VOTE = '🌊';

// --- Cadangan ---
// Data pemain & setelan sekarang di PostgreSQL; yang masih file cuma gudang soal.
export const BACKUP_BERKAS = ['soal-arka.json', 'soal-lagu.json'];
export const CHANNEL_CADANGAN = '1536369402419744789';
export const JAM_BACKUP = 3;

// --- Channel tambahan (ekonomi & sosial) ---
export const CHANNEL_CUACA = process.env.ARKA_CHANNEL_CUACA || process.env.ARKA_CHANNEL_QUEST || '1535918526156767242';
export const CHANNEL_MISI = process.env.ARKA_CHANNEL_MISI || process.env.ARKA_CHANNEL_QUEST || '1535918526156767242';
export const CHANNEL_TOKO = process.env.ARKA_CHANNEL_TOKO || '1535916450533998632';
export const CHANNEL_RANTAI = process.env.ARKA_CHANNEL_RANTAI || '1536719492334362626';

// --- XP chat & voice ---
export const MINIMAL_HURUF = 4;
export const XP_CHAT: [number, number] = [8, 15];
export const JEDA_CHAT_MS = 60_000;
export const XP_VOICE = 12;
export const JEDA_VOICE_MS = 300_000;
export const PET_KENYANG_PER_CHAT = 0.4;

// --- Rekap mingguan ---
export const HARI_REKAP = 0; // Senin
export const JAM_REKAP = 8;
export const ROLE_JUARA = 'Wave Champion';

// --- Kategori game buat sorotan rekap ---
export const KATEGORI_GAME: Record<string, string[]> = {
  'Quiz & Trivia': ['trivia'],
  'Summer Events': ['balon'],
  Games: ['hunt'],
  'Summer Contest': ['lomba'],
  'Summer Games': ['tebak', 'suit', 'duel', 'turnamen'],
  'Kata & Rantai': ['rantai'],
  'Tebak Tebakan': ['lagu', 'akinator']
};
export const NAMA_GAME: Record<string, string> = {
  trivia: 'Trivia',
  balon: 'Perang Balon',
  hunt: 'Jelajah Pantai',
  tebak: 'Tebak Angka',
  suit: 'Suit',
  duel: 'Duel',
  lomba: 'Lomba Kiriman',
  rantai: 'Rantai Kata',
  lagu: 'Tebak Lagu',
  akinator: 'Akinator',
  turnamen: 'Turnamen Suit'
};
