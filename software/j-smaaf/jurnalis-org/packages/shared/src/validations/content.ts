import { z } from 'zod'

export const contentFormSchema = z.object({
  title: z.string().min(3, 'Judul minimal 3 karakter').max(200),
  excerpt: z.string().max(500).optional().nullable(),
  content: z.string().default(''),
  category: z.enum(['sma', 'jurnal', 'liputan', 'mading']),
  cover_image: z.string().url().optional().nullable(),
  tags: z.array(z.string().max(30)).max(10).default([]),
  youtube_id: z.string().max(20).optional().nullable(),
  is_featured: z.boolean().default(false),
  seo_title: z.string().max(200).optional().nullable(),
  seo_desc: z.string().max(300).optional().nullable(),
})
export type ContentFormInput = z.infer<typeof contentFormSchema>

export const contentStageUpdateSchema = z.object({
  status: z.enum(['draft', 'pending', 'review', 'revision', 'published', 'archived']),
  notes: z.string().max(500).optional().nullable(),
})
export type ContentStageUpdateInput = z.infer<typeof contentStageUpdateSchema>

export const contentCalendarSchema = z.object({
  title: z.string().min(3).max(200),
  scheduled_at: z.string().datetime({ offset: true }),
  category: z.enum(['sma', 'jurnal', 'liputan', 'mading']).optional().nullable(),
  content_id: z.string().uuid().optional().nullable(),
  assignee_id: z.string().uuid().optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
})
export type ContentCalendarInput = z.infer<typeof contentCalendarSchema>
