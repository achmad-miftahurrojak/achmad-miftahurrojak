import { z } from 'zod'

export const taskAttachmentSchema = z.object({
  url: z.string().url(),
  name: z.string().min(1).max(255),
})

export const taskCreateSchema = z.object({
  title: z.string().min(3, 'Judul minimal 3 karakter').max(200),
  description: z.string().max(5000).optional().nullable(),
  type: z.enum(['liputan', 'editing', 'desain', 'foto', 'video', 'administrasi', 'lainnya']).default('lainnya'),
  assigned_to: z.string().uuid().optional().nullable(),
  project_id: z.string().uuid().optional().nullable(),
  due_date: z.string().datetime({ offset: true }).optional().nullable(),
  estimated_hours: z.number().int().min(0).max(1000).default(0),
  weight: z.number().int().min(0).max(100).optional(),
})
export type TaskCreateInput = z.infer<typeof taskCreateSchema>

export const taskSubmitSchema = z.object({
  notes: z.string().max(2000).optional().nullable(),
  attachments: z.array(taskAttachmentSchema).max(10).default([]),
})
export type TaskSubmitInput = z.infer<typeof taskSubmitSchema>

export const taskStatusUpdateSchema = z.object({
  status: z.enum(['pending', 'in_progress', 'review', 'revision', 'completed', 'cancelled']),
  notes: z.string().max(1000).optional().nullable(),
})
export type TaskStatusUpdateInput = z.infer<typeof taskStatusUpdateSchema>

export const taskCommentSchema = z.object({
  content: z.string().min(1, 'Komentar tidak boleh kosong').max(2000),
})
export type TaskCommentInput = z.infer<typeof taskCommentSchema>
