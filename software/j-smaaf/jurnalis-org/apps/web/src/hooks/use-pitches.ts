'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { apiJson } from '@/lib/api-client'
import type { PitchFormInput } from '@jurnalis-org/shared/validations/pitches'

export interface Pitch {
  id: string
  title: string
  description: string
  category: string | null
  estimated_effort: string | null
  expected_impact: string | null
  status: string
  upvotes: number
  downvotes: number
  my_vote: number
  created_at: string
  author: { id: string; full_name: string; avatar_url: string | null } | null
}

interface PitchListResponse {
  data: Pitch[]
  meta: { total: number; page: number; totalPages: number }
}

export function usePitches(page = 1) {
  return useQuery({
    queryKey: ['pitches', page],
    queryFn: () => apiJson<PitchListResponse>(`/api/pitches?page=${page}`),
  })
}

export function usePitch(id: string) {
  return useQuery({
    queryKey: ['pitches', 'detail', id],
    queryFn: async () => (await apiJson<{ pitch: Pitch }>(`/api/pitches/${id}`)).pitch,
  })
}

export function useCreatePitch() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: PitchFormInput) =>
      apiJson<{ pitch: Pitch }>('/api/pitches', { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: () => {
      toast.success('Ide berhasil diposting')
      void queryClient.invalidateQueries({ queryKey: ['pitches'] })
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useVotePitch() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, vote }: { id: string; vote: 1 | -1 }) =>
      apiJson(`/api/pitches/${id}/vote`, { method: 'POST', body: JSON.stringify({ vote }) }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['pitches'] })
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useUpdatePitchStatus() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      apiJson(`/api/pitches/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) }),
    onSuccess: () => {
      toast.success('Status pitch diperbarui')
      void queryClient.invalidateQueries({ queryKey: ['pitches'] })
    },
    onError: (err: Error) => toast.error(err.message),
  })
}
