import { z } from 'zod'

export const pitchFormSchema = z.object({
  title: z.string().min(5, 'Judul minimal 5 karakter').max(200),
  description: z.string().min(20, 'Deskripsi minimal 20 karakter').max(5000),
  category: z.string().max(50).optional().nullable(),
  estimated_effort: z.string().max(100).optional().nullable(),
  expected_impact: z.string().max(500).optional().nullable(),
})
export type PitchFormInput = z.infer<typeof pitchFormSchema>

export const pitchVoteSchema = z.object({
  vote: z.union([z.literal(1), z.literal(-1)]),
})
export type PitchVoteInput = z.infer<typeof pitchVoteSchema>

export const pitchStatusSchema = z.object({
  status: z.enum(['draft', 'open', 'approved', 'rejected', 'archived']),
})
export type PitchStatusInput = z.infer<typeof pitchStatusSchema>
