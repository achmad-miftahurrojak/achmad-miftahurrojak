'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { apiJson } from '@/lib/api-client'
import type { TaskCreateInput, TaskSubmitInput } from '@jurnalis-org/shared/validations/tasks'

export interface TaskAssignee {
  id: string
  full_name: string
  avatar_url: string | null
}

export interface Task {
  id: string
  title: string
  description: string | null
  type: string
  status: string
  weight: number
  due_date: string | null
  completed_at: string | null
  created_at: string
  assignee: TaskAssignee | null
  project: { id: string; title: string } | null
}

export interface TaskComment {
  id: string
  content: string
  created_at: string
  author: TaskAssignee
}

export interface TaskHistoryEntry {
  id: string
  action: string
  from_value: string | null
  to_value: string | null
  notes: string | null
  created_at: string
  actor: { id: string; full_name: string }
}

export interface TaskDetail extends Task {
  attachments: { url: string; name: string }[]
  notes: string | null
  assigned_to: string | null
  assigned_by: string | null
  assigner: { id: string; full_name: string } | null
  comments: TaskComment[]
  history: TaskHistoryEntry[]
}

export interface Member {
  id: string
  full_name: string
  nickname: string | null
  role: string
  division: string | null
  avatar_url: string | null
}

interface TaskListResponse {
  data: Task[]
  meta: { total: number; page: number; totalPages: number }
}

export function useTasks(page = 1, status?: string) {
  const params = new URLSearchParams({ page: String(page) })
  if (status) params.set('status', status)
  return useQuery({
    queryKey: ['tasks', page, status],
    queryFn: () => apiJson<TaskListResponse>(`/api/tasks?${params}`),
  })
}

export function useTask(id: string) {
  return useQuery({
    queryKey: ['tasks', 'detail', id],
    queryFn: async () => (await apiJson<{ task: TaskDetail }>(`/api/tasks/${id}`)).task,
  })
}

export function useSubmitTask(taskId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: TaskSubmitInput) =>
      apiJson(`/api/tasks/${taskId}/submit`, { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: () => {
      toast.success('Tugas berhasil disubmit untuk review')
      void queryClient.invalidateQueries({ queryKey: ['tasks'] })
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useUpdateTaskStatus() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, status, notes }: { id: string; status: string; notes?: string }) =>
      apiJson(`/api/tasks/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status, notes }) }),
    onSuccess: () => {
      toast.success('Status tugas diperbarui')
      void queryClient.invalidateQueries({ queryKey: ['tasks'] })
      void queryClient.invalidateQueries({ queryKey: ['projects'] })
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useCreateTask() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: TaskCreateInput) =>
      apiJson('/api/tasks', { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: () => {
      toast.success('Tugas berhasil dibuat')
      void queryClient.invalidateQueries({ queryKey: ['tasks'] })
      void queryClient.invalidateQueries({ queryKey: ['projects'] })
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useAddComment(taskId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (content: string) =>
      apiJson(`/api/tasks/${taskId}/comments`, { method: 'POST', body: JSON.stringify({ content }) }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['tasks', 'detail', taskId] })
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useMembers() {
  return useQuery({
    queryKey: ['members'],
    queryFn: () => apiJson<{ data: Member[] }>('/api/users/members'),
    staleTime: 5 * 60 * 1000,
  })
}
