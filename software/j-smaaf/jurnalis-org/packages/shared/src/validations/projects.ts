import { z } from 'zod'

export const projectFormSchema = z.object({
  title: z.string().min(3, 'Judul minimal 3 karakter').max(200),
  description: z.string().max(5000).optional().nullable(),
  category: z.string().max(50).optional().nullable(),
  status: z.enum(['planning', 'active', 'on_hold', 'completed', 'cancelled']).default('planning'),
  coordinator_id: z.string().uuid().optional().nullable(),
  start_date: z.string().optional().nullable(),
  end_date: z.string().optional().nullable(),
  estimated_hours: z.number().int().min(0).default(0),
  cover_image: z.string().url().optional().nullable(),
})
export type ProjectFormInput = z.infer<typeof projectFormSchema>
