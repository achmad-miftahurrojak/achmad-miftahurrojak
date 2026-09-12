'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { apiJson } from '@/lib/api-client'
import type { FinanceTransactionInput } from '@jurnalis-org/shared/validations/finance'

export interface FinanceTransaction {
  id: string
  type: 'pemasukan' | 'pengeluaran'
  amount: number
  description: string
  category: string | null
  proof_url: string | null
  status: 'pending' | 'approved' | 'rejected'
  created_at: string
  recorder: { id: string; full_name: string } | null
  approver: { id: string; full_name: string } | null
}

export interface FinanceSummary {
  balance: number
  totalIn: number
  totalOut: number
  pendingCount: number
  monthly: { month: string; pemasukan: number; pengeluaran: number }[]
}

interface FinanceListResponse {
  data: FinanceTransaction[]
  meta: { total: number; page: number; totalPages: number }
}

export function useFinanceList(page = 1, status?: string) {
  const params = new URLSearchParams({ page: String(page) })
  if (status) params.set('status', status)
  return useQuery({
    queryKey: ['finance', page, status],
    queryFn: () => apiJson<FinanceListResponse>(`/api/finance?${params}`),
  })
}

export function useFinanceSummary() {
  return useQuery({
    queryKey: ['finance', 'summary'],
    queryFn: () => apiJson<FinanceSummary>('/api/finance/summary'),
  })
}

export function useCreateTransaction() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: FinanceTransactionInput) =>
      apiJson('/api/finance', { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: () => {
      toast.success('Transaksi dicatat, menunggu approval ketua')
      void queryClient.invalidateQueries({ queryKey: ['finance'] })
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useApproveTransaction() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'approved' | 'rejected' }) =>
      apiJson(`/api/finance/${id}/approval`, { method: 'POST', body: JSON.stringify({ action }) }),
    onSuccess: () => {
      toast.success('Status transaksi diperbarui')
      void queryClient.invalidateQueries({ queryKey: ['finance'] })
    },
    onError: (err: Error) => toast.error(err.message),
  })
}
