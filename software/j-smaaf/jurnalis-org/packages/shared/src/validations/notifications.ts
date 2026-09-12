import { z } from 'zod'

export const notificationPayloadSchema = z.object({
  recipient_id: z.string().uuid(),
  type: z.string().min(1).max(50),
  title: z.string().min(1).max(200),
  message: z.string().min(1).max(1000),
  data: z.record(z.unknown()).default({}),
  channel: z.enum(['in_app', 'whatsapp', 'email']).default('in_app'),
})
export type NotificationPayloadInput = z.infer<typeof notificationPayloadSchema>

export const knowledgeFormSchema = z.object({
  title: z.string().min(3, 'Judul minimal 3 karakter').max(200),
  content: z.string().min(10, 'Konten minimal 10 karakter'),
  category: z.string().max(50).optional().nullable(),
  is_public: z.boolean().default(false),
  order_index: z.number().int().min(0).default(0),
})
export type KnowledgeFormInput = z.infer<typeof knowledgeFormSchema>

export const faqFormSchema = z.object({
  question: z.string().min(5, 'Pertanyaan minimal 5 karakter').max(500),
  answer: z.string().min(5, 'Jawaban minimal 5 karakter').max(5000),
  category: z.string().max(50).optional().nullable(),
  order_index: z.number().int().min(0).default(0),
})
export type FaqFormInput = z.infer<typeof faqFormSchema>

export const contactFormSchema = z.object({
  name: z.string().min(2, 'Nama minimal 2 karakter').max(100),
  email: z.string().email('Format email tidak valid'),
  subject: z.string().min(3, 'Subjek minimal 3 karakter').max(200),
  message: z.string().min(10, 'Pesan minimal 10 karakter').max(5000),
})
export type ContactFormInput = z.infer<typeof contactFormSchema>

export const alumniProfileSchema = z.object({
  graduation_year: z.number().int().min(1990).max(2100).optional().nullable(),
  current_job: z.string().max(100).optional().nullable(),
  company: z.string().max(100).optional().nullable(),
  linkedin_url: z.string().url().optional().nullable().or(z.literal('')),
  is_mentor: z.boolean().default(false),
  mentor_fields: z.array(z.string().max(50)).max(10).default([]),
})
export type AlumniProfileInput = z.infer<typeof alumniProfileSchema>

export const notificationPrefSchema = z.object({
  notif_type: z.string().min(1).max(50),
  in_app: z.boolean().default(true),
  whatsapp: z.boolean().default(true),
  email: z.boolean().default(true),
})
export type NotificationPrefInput = z.infer<typeof notificationPrefSchema>
