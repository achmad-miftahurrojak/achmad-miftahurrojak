import { z } from 'zod'

export const signedUrlSchema = z.object({
  filename: z.string().min(1).max(255),
  contentType: z.string().min(1).max(100),
  bucket: z.enum(['public', 'private']),
  folder: z.string().max(100).optional().default('uploads'),
})
export type SignedUrlInput = z.infer<typeof signedUrlSchema>

export const downloadUrlSchema = z.object({
  path: z.string().min(1).max(500),
  bucket: z.enum(['public', 'private']),
})
export type DownloadUrlInput = z.infer<typeof downloadUrlSchema>
