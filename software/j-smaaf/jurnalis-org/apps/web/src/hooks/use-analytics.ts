'use client'

import { useQuery } from '@tanstack/react-query'
import { apiJson } from '@/lib/api-client'

export interface AnalyticsOverview {
  viewsPerDay: { day: string; views: number }[]
  topContent: { id: string; title: string; views: number }[]
  taskCompletions: { day: string; count: number }[]
  totals: Record<string, number>
}

export function useAnalyticsOverview() {
  return useQuery({
    queryKey: ['analytics', 'overview'],
    queryFn: () => apiJson<AnalyticsOverview>('/api/analytics/overview'),
  })
}
