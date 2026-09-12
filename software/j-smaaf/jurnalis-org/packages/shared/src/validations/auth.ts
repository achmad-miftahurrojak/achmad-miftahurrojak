import { z } from 'zod'

export const registerSchema = z.object({
  full_name: z.string().min(2, 'Nama lengkap minimal 2 karakter').max(100),
  nickname: z.string().max(50).optional(),
  email: z.string().email('Format email tidak valid'),
  password: z.string().min(8, 'Password minimal 8 karakter').max(100),
  phone: z.string().regex(/^(\+?62|0)8\d{7,11}$/, 'Format nomor HP tidak valid').optional().or(z.literal('')),
  angkatan: z.number().int().min(1990).max(2100).optional(),
  division: z.string().max(50).optional(),
})
export type RegisterInput = z.infer<typeof registerSchema>

export const loginSchema = z.object({
  email: z.string().email('Format email tidak valid'),
  password: z.string().min(1, 'Password wajib diisi'),
})
export type LoginInput = z.infer<typeof loginSchema>

export const forgotPasswordSchema = z.object({
  email: z.string().email('Format email tidak valid'),
})
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8, 'Password minimal 8 karakter').max(100),
})
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>

export const updateProfileSchema = z.object({
  full_name: z.string().min(2).max(100).optional(),
  nickname: z.string().max(50).optional().nullable(),
  phone: z.string().regex(/^(\+?62|0)8\d{7,11}$/, 'Format nomor HP tidak valid').optional().or(z.literal('')).nullable(),
  avatar_url: z.string().url().optional().nullable(),
  division: z.string().max(50).optional().nullable(),
  bio: z.string().max(500).optional().nullable(),
  angkatan: z.number().int().min(1990).max(2100).optional().nullable(),
  email_notifications: z.boolean().optional(),
  wa_notifications: z.boolean().optional(),
})
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>

export const adminUpdateUserSchema = z.object({
  role: z.enum(['anggota', 'pengurus', 'bendahara', 'redaktur', 'ketua', 'alumni', 'admin']).optional(),
  is_active: z.boolean().optional(),
  division: z.string().max(50).optional().nullable(),
  angkatan: z.number().int().min(1990).max(2100).optional().nullable(),
})
export type AdminUpdateUserInput = z.infer<typeof adminUpdateUserSchema>
