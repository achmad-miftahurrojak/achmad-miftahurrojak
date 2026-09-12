'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { apiJson, apiFetch } from '@/lib/api-client'

export interface PerformancePeriod {
  id: string
  name: string
  start_date: string
  end_date: string
  is_active: boolean
}

export interface PerformanceRecord {
  id: string
  profile_id: string
  tasks_completed: number
  tasks_on_time: number
  tasks_late: number
  total_weight: number
  attendance_total: number
  attendance_hadir: number
  content_published: number
  overall_score: number
  profile: {
    id: string
    full_name: string
    nickname: string | null
    avatar_url: string | null
    division: string | null
  }
}

export function usePerformance(periodId?: string) {
  const params = periodId ? `?period_id=${periodId}` : ''
  return useQuery({
    queryKey: ['performance', periodId],
    queryFn: () => apiJson<{ period: PerformancePeriod | null; records: PerformanceRecord[] }>(`/api/performance${params}`),
  })
}

export function useMyPerformance(userId: string) {
  return useQuery({
    queryKey: ['performance', 'user', userId],
    queryFn: () => apiJson<{ records: (Omit<PerformanceRecord, 'profile'> & { period: PerformancePeriod })[] }>(`/api/performance/${userId}`),
  })
}

export function useRecalculatePerformance() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => apiFetch('/api/performance/recalculate', { method: 'POST' }),
    onSuccess: () => {
      toast.success('Skor kinerja dihitung ulang')
      void queryClient.invalidateQueries({ queryKey: ['performance'] })
    },
    onError: () => toast.error('Gagal menghitung ulang'),
  })
}
