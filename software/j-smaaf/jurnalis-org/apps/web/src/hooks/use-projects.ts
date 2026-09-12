'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { apiJson } from '@/lib/api-client'
import type { ProjectFormInput } from '@jurnalis-org/shared/validations/projects'
import type { Task } from './use-tasks'

export interface Project {
  id: string
  title: string
  description: string | null
  category: string | null
  status: string
  start_date: string | null
  end_date: string | null
  task_count: number
  progress: number
  coordinator: { id: string; full_name: string; avatar_url: string | null } | null
}

export interface ProjectDetail extends Omit<Project, 'task_count'> {
  tasks: Task[]
}

interface ProjectListResponse {
  data: Project[]
  meta: { total: number; page: number; totalPages: number }
}

export function useProjects(page = 1) {
  return useQuery({
    queryKey: ['projects', page],
    queryFn: () => apiJson<ProjectListResponse>(`/api/projects?page=${page}`),
  })
}

export function useProject(id: string) {
  return useQuery({
    queryKey: ['projects', 'detail', id],
    queryFn: async () => (await apiJson<{ project: ProjectDetail }>(`/api/projects/${id}`)).project,
  })
}

export function useCreateProject() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: ProjectFormInput) =>
      apiJson<{ project: Project }>('/api/projects', { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: () => {
      toast.success('Proyek berhasil dibuat')
      void queryClient.invalidateQueries({ queryKey: ['projects'] })
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useUpdateTaskStatusInProject(projectId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      apiJson(`/api/tasks/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['projects', 'detail', projectId] })
      void queryClient.invalidateQueries({ queryKey: ['tasks'] })
    },
    onError: (err: Error) => toast.error(err.message),
  })
}
