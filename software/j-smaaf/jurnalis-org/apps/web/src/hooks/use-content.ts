'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { apiJson } from '@/lib/api-client'
import type { ContentFormInput } from '@jurnalis-org/shared/validations/content'

export interface ContentItem {
  id: string
  title: string
  slug: string
  excerpt: string | null
  category: string
  status: string
  cover_image: string | null
  published_at: string | null
  views: number
  likes: number
  is_featured: boolean
  updated_at: string
  author: { id: string; full_name: string; avatar_url: string | null } | null
}

export interface ContentDetail extends ContentItem {
  content: string
  tags: string[]
  youtube_id: string | null
  seo_title: string | null
  seo_desc: string | null
  author_id: string | null
  editor: { id: string; full_name: string } | null
}

export interface CalendarEntry {
  id: string
  title: string
  scheduled_at: string
  category: string | null
  status: string
  notes: string | null
  content: { id: string; title: string; slug: string; status: string } | null
  assignee: { id: string; full_name: string; avatar_url: string | null } | null
}

interface ContentListResponse {
  data: ContentItem[]
  meta: { total: number; page: number; totalPages: number }
}

export function useContentList(page = 1, status?: string) {
  const params = new URLSearchParams({ page: String(page) })
  if (status) params.set('status', status)
  return useQuery({
    queryKey: ['content', page, status],
    queryFn: () => apiJson<ContentListResponse>(`/api/content?${params}`),
  })
}

export function useContent(id: string) {
  return useQuery({
    queryKey: ['content', 'detail', id],
    queryFn: async () => (await apiJson<{ item: ContentDetail }>(`/api/content/${id}`)).item,
  })
}

export function useCreateContent() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: ContentFormInput) =>
      apiJson<{ item: ContentItem }>('/api/content', { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: () => {
      toast.success('Konten berhasil dibuat')
      void queryClient.invalidateQueries({ queryKey: ['content'] })
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useUpdateContent(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: Partial<ContentFormInput>) =>
      apiJson(`/api/content/${id}`, { method: 'PATCH', body: JSON.stringify(input) }),
    onSuccess: () => {
      toast.success('Konten diperbarui')
      void queryClient.invalidateQueries({ queryKey: ['content'] })
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useUpdateContentStage() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      apiJson(`/api/content/${id}/stage`, { method: 'PATCH', body: JSON.stringify({ status }) }),
    onSuccess: () => {
      toast.success('Status konten diperbarui')
      void queryClient.invalidateQueries({ queryKey: ['content'] })
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useLikeContent() {
  return useMutation({
    mutationFn: (id: string) =>
      apiJson<{ liked: boolean; likes: number }>(`/api/content/${id}/like`, { method: 'POST' }),
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useContentCalendar(from?: string, to?: string) {
  const params = new URLSearchParams()
  if (from) params.set('from', from)
  if (to) params.set('to', to)
  return useQuery({
    queryKey: ['content-calendar', from, to],
    queryFn: () => apiJson<{ data: CalendarEntry[] }>(`/api/content/calendar/list?${params}`),
  })
}
