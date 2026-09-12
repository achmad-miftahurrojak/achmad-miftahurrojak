import { z } from 'zod'

export const orgStructureSchema = z.object({
  profile_id: z.string().uuid(),
  position: z.string().min(2).max(100),
  division: z.string().max(50).optional().nullable(),
  period_year: z.number().int().min(1990).max(2100),
  order_index: z.number().int().min(0).default(0),
})
export type OrgStructureInput = z.infer<typeof orgStructureSchema>

export const achievementSchema = z.object({
  title: z.string().min(3).max(200),
  category: z.enum(['lomba', 'penghargaan', 'publikasi']),
  year: z.number().int().min(1990).max(2100),
  description: z.string().max(1000).optional().nullable(),
  image_url: z.string().url().optional().nullable(),
})
export type AchievementInput = z.infer<typeof achievementSchema>

export const analyticsTrackSchema = z.object({
  event_type: z.enum(['content_view', 'content_like', 'task_completed', 'login']),
  entity_type: z.string().max(50).optional().nullable(),
  entity_id: z.string().uuid().optional().nullable(),
  metadata: z.record(z.unknown()).default({}),
})
export type AnalyticsTrackInput = z.infer<typeof analyticsTrackSchema>

export const orgProfileSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  tagline: z.string().max(200).optional().nullable(),
  vision: z.string().max(2000).optional().nullable(),
  mission: z.array(z.string().max(500)).max(20).optional(),
  founded_year: z.number().int().min(1900).max(2100).optional().nullable(),
  logo_url: z.string().url().optional().nullable(),
  cover_url: z.string().url().optional().nullable(),
  contact_email: z.string().email().optional().nullable(),
  contact_phone: z.string().max(20).optional().nullable(),
  address: z.string().max(500).optional().nullable(),
})
export type OrgProfileInput = z.infer<typeof orgProfileSchema>
