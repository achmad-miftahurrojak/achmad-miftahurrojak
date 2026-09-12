'use client'

import { use, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Calendar, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { LoadingSkeleton } from '@/components/ui/loading-skeleton'
import { ProjectKanban } from '@/components/projects/project-kanban'
import { AssignTaskForm } from '@/components/projects/assign-task-form'
import { useProject } from '@/hooks/use-projects'
import { useUser } from '@/hooks/use-user'
import { formatDate } from '@/lib/utils'
import { PENGURUS_OR_ABOVE } from '@jurnalis-org/shared/constants'

export default function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const { data: project, isLoading } = useProject(id)
  const { data: user } = useUser()
  const [assignOpen, setAssignOpen] = useState(false)
  const canManage = user ? (PENGURUS_OR_ABOVE as readonly string[]).includes(user.role) : false

  if (isLoading || !project) return <LoadingSkeleton rows={5} />

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Kembali
          </Button>
          <h1 className="text-2xl font-bold">{project.title}</h1>
          {project.description && <p className="text-sm text-muted-foreground">{project.description}</p>}
          {project.end_date && (
            <p className="flex items-center gap-1 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4" /> Deadline: {formatDate(project.end_date)}
            </p>
          )}
        </div>
        {canManage && (
          <Button onClick={() => setAssignOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> Tambah Tugas
          </Button>
        )}
      </div>
      <div className="space-y-1">
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>Progres keseluruhan</span>
          <span>{project.progress}%</span>
        </div>
        <Progress value={project.progress} />
      </div>
      <ProjectKanban tasks={project.tasks} projectId={project.id} />
      <AssignTaskForm projectId={project.id} open={assignOpen} onOpenChange={setAssignOpen} />
    </div>
  )
}
