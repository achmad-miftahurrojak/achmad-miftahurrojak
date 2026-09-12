'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { apiFetch, apiJson } from '@/lib/api-client'
import { useRealtime } from './use-realtime'
import { useUser } from './use-user'

export interface NotificationItem {
  id: string
  type: string
  title: string
  message: string
  data: Record<string, unknown>
  read_at: string | null
  created_at: string
}

interface NotificationsPage {
  data: NotificationItem[]
  nextCursor: string | null
}

export function useNotificationSubscription() {
  const queryClient = useQueryClient()
  const { data: user } = useUser()

  useRealtime((event, payload) => {
    if (event === 'notification:new') {
      const p = payload as { title: string; message: string }
      toast.info(p.title, { description: p.message })
      void queryClient.invalidateQueries({ queryKey: ['notifications'] })
      void queryClient.invalidateQueries({ queryKey: ['unread-count'] })
    }
    if (event === 'task:updated') {
      void queryClient.invalidateQueries({ queryKey: ['tasks'] })
    }
  }, Boolean(user))
}

export function useNotifications() {
  return useQuery({
    queryKey: ['notifications'],
    queryFn: () => apiJson<NotificationsPage>('/api/notifications'),
  })
}

export function useUnreadCount() {
  return useQuery({
    queryKey: ['unread-count'],
    queryFn: () => apiJson<{ count: number }>('/api/notifications/unread-count'),
    refetchInterval: 60_000,
  })
}

export function useMarkRead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiFetch(`/api/notifications/${id}/read`, { method: 'POST' }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['notifications'] })
      void queryClient.invalidateQueries({ queryKey: ['unread-count'] })
    },
  })
}

export function useMarkAllRead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => apiFetch('/api/notifications/read-all', { method: 'POST' }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['notifications'] })
      void queryClient.invalidateQueries({ queryKey: ['unread-count'] })
    },
  })
}
