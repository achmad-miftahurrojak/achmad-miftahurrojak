'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { apiJson, apiFetch } from '@/lib/api-client'
import type { MeetingFormInput, AttendanceFormInput } from '@jurnalis-org/shared/validations/meetings'

export interface Meeting {
  id: string
  title: string
  type: string
  description: string | null
  start_time: string
  end_time: string | null
  location: string | null
  link: string | null
  is_mandatory: boolean
  is_closed: boolean
  hadir_count: number
  creator: { id: string; full_name: string } | null
}

export interface AttendanceEntry {
  id: string
  status: string
  proof_url: string | null
  notes: string | null
  profile: {
    id: string
    full_name: string
    nickname: string | null
    avatar_url: string | null
    division: string | null
  }
}

export function useMeetings(from?: string, to?: string) {
  const params = new URLSearchParams()
  if (from) params.set('from', from)
  if (to) params.set('to', to)
  return useQuery({
    queryKey: ['meetings', from, to],
    queryFn: () => apiJson<{ data: Meeting[] }>(`/api/meetings?${params}`),
  })
}

export function useAttendance(meetingId: string) {
  return useQuery({
    queryKey: ['attendance', meetingId],
    queryFn: () => apiJson<{ data: AttendanceEntry[] }>(`/api/meetings/${meetingId}/attendance`),
  })
}

export function useCreateMeeting() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: MeetingFormInput) =>
      apiJson('/api/meetings', { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: () => {
      toast.success('Kegiatan berhasil dibuat')
      void queryClient.invalidateQueries({ queryKey: ['meetings'] })
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useCheckIn(meetingId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: AttendanceFormInput) =>
      apiJson(`/api/meetings/${meetingId}/checkin`, { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: () => {
      toast.success('Absensi tercatat')
      void queryClient.invalidateQueries({ queryKey: ['attendance', meetingId] })
      void queryClient.invalidateQueries({ queryKey: ['meetings'] })
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useMarkAttendance(meetingId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ userId, status }: { userId: string; status: string }) =>
      apiJson(`/api/meetings/${meetingId}/attendance/${userId}`, { method: 'POST', body: JSON.stringify({ status }) }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['attendance', meetingId] })
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useCloseMeeting() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (meetingId: string) => apiFetch(`/api/meetings/${meetingId}/close`, { method: 'PATCH' }),
    onSuccess: () => {
      toast.success('Absensi ditutup')
      void queryClient.invalidateQueries({ queryKey: ['meetings'] })
    },
    onError: () => toast.error('Gagal menutup absensi'),
  })
}
