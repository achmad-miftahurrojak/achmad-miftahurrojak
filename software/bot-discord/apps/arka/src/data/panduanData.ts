// Dibuat otomatis dari cogs/arka/panduan.py — jangan edit manual.
export type PanduanChannel = [string, string, string[]]

export const PANDUAN: Record<string, PanduanChannel> = {
  "1535967600520073306": [
    "🔢  Tebak Angka",
    "Gua nyimpen satu angka rahasia antara **1 sampai 100**. Lo punya **7 kesempatan** buat nebak.",
    [
      "Ketik `/tebak` terus isi angkanya",
      "Gua kasih tau angkanya lebih besar atau lebih kecil",
      "Kalau selisihnya tipis, gua kasih tau juga",
      "Makin dikit tebakan, makin gede XP-nya: 60 sampai 210 XP"
    ]
  ],
  "1535967723836940379": [
    "✂️  Suit",
    "Batu kertas gunting lawan gua, tapi **best of 3**. Menang dua ronde duluan.",
    [
      "Ketik `/suit`, terus mencet tombol tiap ronde",
      "Pilihan gua diputer dulu sebentar sebelum kebuka",
      "Seri ga dihitung, ronde diulang",
      "**Menang 2 ronde duluan = menang pertandingan.** Kalau 2–0, ronde ketiga ga usah dimainin",
      "**Beruntun dihitung antar pertandingan, bukan antar ronde.** Menang pertandingan berkali kali tanpa kalah: 60, 90, 120, 150, 180, sampai mentok 210 XP",
      "Sekali kalah pertandingan, runtutannya balik nol",
      "Mau rame? `/turnamen` buat sistem gugur"
    ]
  ],
  "1535968024937500722": [
    "🥊  Duel",
    "Nantangin member lain, adu cepat rebut XP. Bukan undian, yang menang beneran yang paling gesit.",
    [
      "Ketik `/duel` pilih lawannya, **taruhannya boleh diatur sendiri** dari 10 sampai 5.000 XP",
      "Yang ditantang mencet **Terima** atau **Kabur**, dia berhak nolak",
      "Habis diterima ada hitung mundur, terus **jeda acak**",
      "Begitu tombol SERANG muncul, yang duluan mencet menang",
      "Yang menang ngambil semua taruhannya dari yang kalah",
      "Dua duanya harus punya XP sebanyak taruhannya"
    ]
  ],
  "1535920221884518452": [
    "💦  Perang Balon Air",
    "Adu cepet mencet tombol. Siapa pun boleh ikut, ga usah daftar.",
    [
      "Siapa aja boleh ketik `/balon` buat mulai satu ronde",
      "Gua bilang lagi ngisi balon, terus **diem 3 sampai 9 detik**",
      "Waktunya acak, jadi ga bisa dihitung",
      "Begitu tombolnya muncul, yang paling cepet mencet dapet 90 XP"
    ]
  ],
  "1535917622036791367": [
    "❓  Trivia",
    "Gua kasih soal, **jawabannya diketik langsung di chat**. Ga usah pakai perintah apa apa buat jawab.",
    [
      "Ketik `/trivia` buat munculin soal",
      "Langsung ketik jawabannya di chat, siapa pun boleh",
      "Jawab sebelum petunjuk keluar dapet XP lebih",
      "Kalau mentok, tunggu aja, gua kasih petunjuk hurufnya"
    ]
  ],
  "1535919887673856073": [
    "🎵  Tebak Lagu",
    "Tebak judul lagu dari rebusan emoji. Petunjuknya nambah pelan pelan.",
    [
      "Ketik `/lagu` buat mulai ronde",
      "Jawabannya diketik langsung di chat",
      "Empat tahap petunjuk: emoji → tahun+genre → penyanyi → pola judul",
      "Makin cepet nebak, makin gede XP-nya",
      "Island Owner bisa nambah lewat `/tambahlagu`"
    ]
  ],
  "1535916648765063300": [
    "⚔️  Jelajah Pantai",
    "Nyusurin pantai, siapa tau nemu sesuatu. Ada 11 barang, dari sandal jepit sampai peti harta karun.",
    [
      "Ketik `/hunt` buat jelajah sekali",
      "Bisa diulang tiap **5 menit**",
      "Yang jarang muncul XP-nya paling gede: penyu, botol pesan, peti harta",
      "Ketik `/koleksi` buat liat apa aja yang udah pernah lo temuin"
    ]
  ],
  "1535919366426730506": [
    "🏐  Beach Volleyball",
    "Channel ini buat ngatur jadwal main bareng, mainnya sendiri di voice.",
    [
      "Ketik `/acara` isi nama sama jamnya, contoh `16:00`",
      "Mencet ✅ di pengumumannya kalau mau ikut",
      "Gua ping semua yang daftar **10 menit sebelum mulai**",
      "Yang daftar juga dapet **DM** dari gua, jadi ga bakal kelewat",
      "Ketik `/acaralist` buat liat jadwal yang udah ada",
      "`/acaraedit` ubah jam, `/acarahapus` batalin"
    ]
  ],
  "1535921034891628645": [
    "🎤  Karaoke",
    "Sama kayak volleyball, ini buat ngatur jadwal nyanyi bareng di voice.",
    [
      "Ketik `/acara` isi nama sama jamnya",
      "Mencet ✅ kalau mau ikut",
      "Gua ping 10 menit sebelum mulai, plus **DM** biar ga kelewat",
      "Ketik `/acaralist` buat liat jadwalnya",
      "`/acaraedit` ubah jam, `/acarahapus` batalin"
    ]
  ],
  "1535920856658874460": [
    "🏖️  Lomba Istana Pasir",
    "Lomba kirim karya, yang milih member sendiri.",
    [
      "Yang bikin lomba ketik `/lomba` isi judul sama berapa jam",
      "Selama lomba buka, kirim **gambar** ke channel ini",
      "Gua tempelin 🌊 di tiap kiriman, tinggal member mencet buat milih",
      "**Satu orang cuma boleh vote satu karya.** Vote karya sendiri langsung gua cabut",
      "Habis waktunya gua umumin juara: 300, 150, 75 XP"
    ]
  ],
  "1535918526156767242": [
    "🏝️  Misi Harian",
    "Tiap hari gua kasih **3 misi** yang beda. Semua orang dapet misi yang sama, jadi bisa saling ngomporin.",
    [
      "**Cuaca sama misi hari ini dipajang barengan tiap pagi jam 7**, ga usah ngetik apa apa. Cuaca duluan, misinya nyusul",
      "`/cuaca` sama `/absen` juga dipakai di sini, biar sekali buka langsung beres",
      "Ketik `/misi` buat liat kemajuan lo sendiri. **Cuma lo yang liat hasilnya**, jadi channel ini ga bakal penuh",
      "Misinya nyebar ke game lain: trivia, jelajah, suit, dan sebagainya",
      "Kemajuannya kecatat sendiri, dan gua **DM** tiap satu misi kelar",
      "**Hadiahnya diambil pas lo ketik `/misi`**, jadi jangan lupa balik",
      "Ketiganya kelar dapet bonus 200 XP",
      "**Misi mingguan:** kelarin misi harian 4 hari dalam seminggu, dapet 800 XP",
      "Ada misi yang ga sreg? `/gantimisi` pakai Kerang Ajaib dari toko",
      "Jam 00.00 WIB ganti misi baru"
    ]
  ],
  "1535916450533998632": [
    "🎣  Toko Pantai",
    "Tempat XP lo ada gunanya selain buat pamer. Stok diganti tiap Senin.",
    [
      "**Stok baru dipajang sendiri tiap Senin pagi**, ga usah ngetik apa apa",
      "`/toko` kalau mau liat sekalian XP sama jatah beli lo",
      "`/beli` buat nukar XP jadi barang · `/tas` liat punya lo",
      "`/wishlist` biar gua DM kalau barang incaran masuk stok",
      "`/pakai` buat julukan atau ganti nama Nemo",
      "🐚 Kerang Ajaib ganti misi · 🎣 Kail Perak naikin peluang langka",
      "🐋 Paus Raksasa naikin semua XP 50 persen sehari — paling langka"
    ]
  ],
  "1535960574263820338": [
    "📊  Statistik Pemain",
    "Channel ini cuma buat liat kartu diri lo sendiri.",
    [
      "`/level` liat kedalaman lo udah sampai mana",
      "`/profil` semua data lo dalam satu tampilan",
      "`/absenbulan` rekap absen bulan ini",
      "Koleksi pantai yang lengkap nempel jadi lencana di sini"
    ]
  ],
  "1535836590264557599": [
    "🗓️  Rekap",
    "Tiap Senin jam 8 pagi gua umumin tiga teratas minggu itu, terus hitungan mingguan direset.",
    [
      "`/papan` papan peringkat, bisa diurutin beberapa cara",
      "`/statistik` ringkasan seluruh server",
      "Juara minggu itu dapet role **Wave Champion** seminggu",
      "Ketik `/rekap` kalau mau liat papan mingguan sekarang juga",
      "`/hall` Hall of Fame juara musim lalu"
    ]
  ],
  "1535917843965550692": [
    "🧞  Akinator",
    "Pikirin satu hewan laut atau peliharaan, dan biarin gua yang tebak.",
    [
      "Ketik `/akinator` buat mulai",
      "Pikirin hewannya (misal: penyu, kucing, gurita)",
      "Gua bakal nanya ciri-cirinya maksimal 12 kali",
      "Jawab pakai tombol **Ya** atau **Nggak**",
      "Kalau gua salah nebak atau nyerah, lo dapet **120 XP**"
    ]
  ],
  "1535810881634570372": [
    "🌊  Markas Arka",
    "Channel ini bukan buat main, tapi buat ngatur.",
    [
      "`/bantuan` daftar semua yang gua bisa",
      "`/tambahsoal` nambah soal trivia, khusus Island Owner",
      "`/daftarsoal` liat jumlah soal per kategori",
      "`/backup` cadangan data (Island Owner)",
      "Gamenya ada di channel masing masing, ketik `/panduan` di sana"
    ]
  ]
};

// CHANNEL_RANTAI dari config.py
Object.assign(PANDUAN, {
  "1536719492334362626": [
    "🔠  Rantai Kata",
    "Sambung kata: kata berikutnya harus diawali huruf terakhir kata sebelumnya. Satu orang ga boleh nulis dua kali beruntun.",
    [
      "Langsung ketik **satu kata** di chat (huruf aja, minimal 3 huruf)",
      "Harus diawali huruf terakhir kata sebelumnya",
      "Kata yang udah kepakai di rantai ini ga boleh diulang",
      "Tiap kata bener = **12 XP**",
      "Mecahin rekor = bonus **250 XP**",
      "/rantai buat liat panjang sekarang sama rekor"
    ]
  ]
});
