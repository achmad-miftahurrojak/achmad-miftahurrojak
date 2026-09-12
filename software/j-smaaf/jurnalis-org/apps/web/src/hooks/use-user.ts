'use client'

import { useQuery } from '@tanstack/react-query'
import { apiJson } from '@/lib/api-client'

export interface CurrentUser {
  id: string
  full_name: string
  nickname: string | null
  email: string
  phone: string | null
  avatar_url: string | null
  role: string
  division: string | null
  angkatan: number | null
  bio: string | null
  email_notifications: boolean
  wa_notifications: boolean
}

export function useUser() {
  return useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      const res = await apiJson<{ user: CurrentUser }>('/api/auth/me')
      return res.user
    },
    staleTime: 5 * 60 * 1000,
    retry: false,
  })
}
