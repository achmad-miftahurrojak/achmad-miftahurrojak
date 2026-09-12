'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { apiJson } from '@/lib/api-client'
import type { AlumniProfileInput } from '@jurnalis-org/shared/validations/notifications'

export interface AlumniProfile {
  id: string
  profile_id: string
  graduation_year: number | null
  current_job: string | null
  company: string | null
  linkedin_url: string | null
  is_mentor: boolean
  mentor_fields: string[]
}

export function useMyAlumniProfile() {
  return useQuery({
    queryKey: ['alumni', 'me'],
    queryFn: () => apiJson<{ profile: AlumniProfile | null }>('/api/alumni/me'),
  })
}

export function useUpdateAlumniProfile() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: AlumniProfileInput) =>
      apiJson('/api/alumni/me', { method: 'PUT', body: JSON.stringify(input) }),
    onSuccess: () => {
      toast.success('Profil alumni diperbarui')
      void queryClient.invalidateQueries({ queryKey: ['alumni'] })
    },
    onError: (err: Error) => toast.error(err.message),
  })
}
