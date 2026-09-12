import { z } from 'zod'

export const assetUploadSchema = z.object({
  title: z.string().min(2, 'Judul minimal 2 karakter').max(200),
  category: z.enum(['foto', 'desain', 'dokumentasi']).optional().nullable(),
  original_url: z.string().url(),
  watermarked_url: z.string().url().optional().nullable(),
  related_task_id: z.string().uuid().optional().nullable(),
  related_content_id: z.string().uuid().optional().nullable(),
  tags: z.array(z.string().max(30)).max(10).default([]),
  is_public: z.boolean().default(false),
})
export type AssetUploadInput = z.infer<typeof assetUploadSchema>

export const assetUpdateSchema = z.object({
  title: z.string().min(2).max(200).optional(),
  category: z.enum(['foto', 'desain', 'dokumentasi']).optional().nullable(),
  tags: z.array(z.string().max(30)).max(10).optional(),
  is_public: z.boolean().optional(),
})
export type AssetUpdateInput = z.infer<typeof assetUpdateSchema>
