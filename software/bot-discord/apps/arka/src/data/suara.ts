// Dibuat otomatis dari cogs/arka/voice.py — jangan edit manual.
export const SUARA: Record<string, string[]> = {
  "naik": [
    "PASANG NAIK! {n} nyemplung lebih dalam, sekarang **{x}**.",
    "{n} turun ke **{x}**. Ada yang mau nyusul apa cuma nonton?",
    "Airnya makin dalam buat {n} — **{x}**. Gua catet ya.",
    "Naik satu tingkat! {n} sekarang **{x}**. Yang lain mana nih."
  ],
  "absen": [
    "Hadir! Hari ke-**{x}** beruntun. Nih **{y} XP**, jangan bolong ya.",
    "Absen ke-**{x}**. Gua suka yang rajin. Ambil **{y} XP**.",
    "Muncul juga. Hari ke-**{x}**, dapet **{y} XP**."
  ],
  "absen_putus": [
    "Runtutan lo kemarin putus. Mulai dari satu lagi, jangan bolos.",
    "Kemarin ke mana? Hitungannya balik dari nol nih.",
    "Bolong sehari, hangus semua. Lain kali jangan lupa."
  ],
  "tebak_kena": [
    "KENA! Angkanya emang {x}. {y} kali tebak doang, boleh juga lo.",
    "Tepat {x}! Cuma butuh {y} tebakan. Gua kalah pinter nih.",
    "Betul {x}, {y} langkah. Sini lagi, gua bikin lebih susah."
  ],
  "tebak_meleset": [
    "Bukan {x}. Angkanya {arah}",
    "Salah. {arah}",
    "Bukan itu, {arah}"
  ],
  "tebak_habis": [
    "Abis kesempatan. Angkanya **{x}**. Deket sih, tapi ya kalah.",
    "Nol kesempatan. Jawabannya **{x}**. Coba lagi, gua tunggu.",
    "Habis. **{x}** jawabannya. Kirain lo bisa."
  ],
  "suit_menang": [
    "Yah, lo menang. Nih {x} XP, jangan sombong.",
    "Oke lo menang. {x} XP buat lo. Sekali lagi?",
    "Gua kalah. Ambil {x} XP-nya, gua ga terima ini."
  ],
  "suit_kalah": [
    "HAHA gua menang. Ga dapet apa apa lo.",
    "Kalah. Coba lagi kalau berani.",
    "Gua yang menang. Gampang."
  ],
  "suit_seri": [
    "Seri. Ga seru ah, ulang.",
    "Sama. Nih {x} XP hiburan.",
    "Seri terus. Lo niru gua ya?"
  ],
  "duel_mulai": [
    "⚔️ {a} nantangin {b}! Taruhan {x} XP. Ini bakal seru.",
    "⚔️ {a} nyamperin {b}. {x} XP dipertaruhin. Ayo ayo.",
    "⚔️ Duel! {a} lawan {b}, {x} XP jadi rebutan."
  ],
  "balon_siap": [
    "💧 Gua lagi ngisi balon... siap siap, jangan kedip.",
    "💧 Balonnya lagi diisi air. Yang lengah bakal basah.",
    "💧 Tunggu aba aba. Yang mencet duluan ga ada tombolnya kok."
  ],
  "balon_menang": [
    "💦 **{a}** paling cepet! Ambil {x} XP. Yang lain basah.",
    "💦 Kena! **{a}** nyamber duluan, {x} XP jadi punya dia.",
    "💦 Refleksnya gila. **{a}** menang, {x} XP."
  ],
  "balon_sepi": [
    "Ga ada yang nyamber. Balonnya jatuh sendiri. Sedih.",
    "Sepi banget, ga ada yang mencet. Gua simpen lagi balonnya.",
    "Nol yang gerak. Kalian pada tidur ya?"
  ],
  "hunt_dapat": [
    "{e} Lo nemu **{n}**! Dapet {x} XP.",
    "{e} Ada **{n}** nyangkut. {x} XP masuk.",
    "{e} **{n}**! Lumayan, {x} XP."
  ],
  "hunt_sampah": [
    "{e} Cuma **{n}**. Ya... {x} XP deh, buat usaha.",
    "{e} **{n}**. Pantai emang gitu, ga selalu ada harta.",
    "{e} Dapetnya **{n}**. Jangan sedih, {x} XP tetep gua kasih."
  ],
  "hunt_langka": [
    "{e} EH SERIUS? **{n}**! Ini jarang banget. {x} XP!",
    "{e} **{n}** cuy! Gua sampai kaget. {x} XP buat lo.",
    "{e} Gila, **{n}**. Hoki lo hari ini. {x} XP."
  ],
  "trivia_bener": [
    "🎉 **{a}** bener! Jawabannya **{b}**. Ambil {x} XP.",
    "🎉 Tepat! **{b}**. {a} duluan, {x} XP buat dia.",
    "🎉 **{a}** paling cepet mikir. **{b}** jawabannya, {x} XP."
  ],
  "trivia_habis": [
    "⏰ Waktu habis. Jawabannya **{b}**. Ga ada yang tau ternyata.",
    "⏰ Nol yang bener. Jawabannya **{b}**. Belajar dulu sana.",
    "⏰ Kelamaan mikirnya. **{b}** jawabannya."
  ],
  "duel_selesai": [
    "🌊 **{a}** menang! {x} XP pindah dari {b}. Kasian.",
    "🌊 {b} tumbang. **{a}** bawa pulang {x} XP.",
    "🌊 **{a}** yang menang. {b}, latihan dulu sana."
  ]
};

export function suara(kunci: string, isi: Record<string, string | number> = {}): string {
  const pilihan = SUARA[kunci];
  if (!pilihan || pilihan.length === 0) return '';
  const pilih = pilihan[Math.floor(Math.random() * pilihan.length)];
  return pilih.replace(/\{(\w+)\}/g, (_, k) => String(isi[k] ?? `{${k}}`));
}
