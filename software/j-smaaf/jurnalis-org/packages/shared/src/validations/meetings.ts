import { z } from 'zod'

export const meetingFormSchema = z.object({
  title: z.string().min(3, 'Judul minimal 3 karakter').max(200),
  type: z.enum(['rutin', 'rapat', 'workshop', 'liputan', 'lainnya']).default('rutin'),
  description: z.string().max(2000).optional().nullable(),
  start_time: z.string().datetime({ offset: true }),
  end_time: z.string().datetime({ offset: true }).optional().nullable(),
  location: z.string().max(200).optional().nullable(),
  link: z.string().url().optional().nullable().or(z.literal('')),
  is_mandatory: z.boolean().default(true),
})
export type MeetingFormInput = z.infer<typeof meetingFormSchema>

export const attendanceFormSchema = z.object({
  status: z.enum(['hadir', 'izin', 'sakit', 'alpha']),
  proof_url: z.string().url().optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
})
export type AttendanceFormInput = z.infer<typeof attendanceFormSchema>
