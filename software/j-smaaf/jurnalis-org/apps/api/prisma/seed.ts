import { PrismaClient } from '@prisma/client'
import argon2 from 'argon2'

const prisma = new PrismaClient()

async function main() {
  const org = await prisma.orgProfile.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      name: 'Jurnalis Org',
      tagline: 'Mencerdaskan lewat tulisan',
      vision: 'Menjadi organisasi jurnalistik sekolah yang kritis, kreatif, dan berintegritas.',
      mission: [
        'Melatih keterampilan menulis dan jurnalistik anggota',
        'Menerbitkan konten berkualitas secara berkala',
        'Membangun budaya literasi di sekolah',
      ],
      founded_year: 2015,
      contact_email: 'redaksi@jurnalis.org',
      social_media: {},
    },
  })
  console.log('Org profile:', org.id)

  const faqs = [
    { question: 'Bagaimana cara bergabung?', answer: 'Hubungi pengurus atau daftar lewat halaman registrasi, lalu tunggu aktivasi oleh admin.', category: 'umum', order_index: 0 },
    { question: 'Apa saja divisi yang tersedia?', answer: 'Liputan, editing, desain, foto, video, dan administrasi.', category: 'umum', order_index: 1 },
    { question: 'Bagaimana sistem tugas bekerja?', answer: 'Pengurus memberikan tugas dengan bobot tertentu. Selesaikan sebelum deadline untuk skor kinerja maksimal.', category: 'tugas', order_index: 2 },
  ]
  for (const faq of faqs) {
    const existing = await prisma.faq.findFirst({ where: { question: faq.question } })
    if (!existing) await prisma.faq.create({ data: faq })
  }
  console.log('FAQs seeded:', faqs.length)

  const now = new Date()
  const end = new Date(now)
  end.setMonth(end.getMonth() + 6)
  const periodName = `Periode ${now.getFullYear()}`
  const period = await prisma.performancePeriod.findFirst({ where: { name: periodName } })
    ?? await prisma.performancePeriod.create({
      data: {
        name: periodName,
        start_date: now,
        end_date: end,
        is_active: true,
      },
    })
  console.log('Performance period:', period.id)

  const kbTitle = 'Standar Operasional Penulisan Berita'
  const kb = await prisma.knowledgeBase.findFirst({ where: { title: kbTitle } })
    ?? await prisma.knowledgeBase.create({
      data: {
        title: kbTitle,
        content: '1. Tentukan angle berita.\n2. Lakukan riset dan wawancara.\n3. Tulis dengan piramida terbalik.\n4. Sertakan kutipan narasumber.\n5. Submit ke redaktur untuk review.',
        category: 'sop',
        is_public: true,
        order_index: 0,
      },
    })
  console.log('Knowledge base:', kb.id)

  const admin = await prisma.user.upsert({
    where: { email: 'admin@jurnalis.org' },
    update: {},
    create: {
      full_name: 'Administrator',
      email: 'admin@jurnalis.org',
      password_hash: await argon2.hash('GantiPasswordIni123!', { type: argon2.argon2id }),
      role: 'admin',
    },
  })
  console.log('Admin user:', admin.email)
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
