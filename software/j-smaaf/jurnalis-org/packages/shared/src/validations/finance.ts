import { z } from 'zod'

export const financeTransactionSchema = z.object({
  type: z.enum(['pemasukan', 'pengeluaran']),
  amount: z.number().positive('Jumlah harus lebih dari 0').max(999999999),
  description: z.string().min(3, 'Deskripsi minimal 3 karakter').max(500),
  category: z.string().max(50).optional().nullable(),
  proof_url: z.string().url().optional().nullable(),
})
export type FinanceTransactionInput = z.infer<typeof financeTransactionSchema>

export const financeApprovalSchema = z.object({
  action: z.enum(['approved', 'rejected']),
  notes: z.string().max(500).optional().nullable(),
})
export type FinanceApprovalInput = z.infer<typeof financeApprovalSchema>
