'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { apiJson, apiFetch } from '@/lib/api-client'
import type { AssetUploadInput } from '@jurnalis-org/shared/validations/assets'

export interface Asset {
  id: string
  title: string
  category: string | null
  original_url: string
  watermarked_url: string | null
  watermark_status: string
  tags: string[]
  is_public: boolean
  created_at: string
  uploader: { id: string; full_name: string; avatar_url: string | null } | null
}

interface AssetListResponse {
  data: Asset[]
  meta: { total: number; page: number; totalPages: number }
}

export function useAssets(page = 1, category?: string) {
  const params = new URLSearchParams({ page: String(page) })
  if (category) params.set('category', category)
  return useQuery({
    queryKey: ['assets', page, category],
    queryFn: () => apiJson<AssetListResponse>(`/api/assets?${params}`),
  })
}

export function useCreateAsset() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: AssetUploadInput) =>
      apiJson('/api/assets', { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: () => {
      toast.success('Aset berhasil ditambahkan')
      void queryClient.invalidateQueries({ queryKey: ['assets'] })
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useDeleteAsset() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiFetch(`/api/assets/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('Aset dihapus')
      void queryClient.invalidateQueries({ queryKey: ['assets'] })
    },
    onError: () => toast.error('Gagal menghapus aset'),
  })
}
