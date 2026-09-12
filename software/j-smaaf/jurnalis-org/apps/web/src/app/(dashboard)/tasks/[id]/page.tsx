'use client'

import { use } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Calendar, FileText, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { StatusBadge } from '@/components/ui/status-badge'
import { LoadingSkeleton } from '@/components/ui/loading-skeleton'
import { TaskComments } from '@/components/tasks/task-comments'
import { TaskHistoryTimeline } from '@/components/tasks/task-history-timeline'
import { useTask, useUpdateTaskStatus } from '@/hooks/use-tasks'
import { useUser } from '@/hooks/use-user'
import { formatDate, formatDateTime } from '@/lib/utils'
import { TASK_TYPE_LABELS, PENGURUS_OR_ABOVE } from '@jurnalis-org/shared/constants'

export default function TaskDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const { data: task, isLoading } = useTask(id)
  const { data: user } = useUser()
  const updateStatus = useUpdateTaskStatus()

  if (isLoading || !task) return <LoadingSkeleton rows={5} />

  const isAssignee = task.assigned_to === user?.id
  const isManager = user ? (PENGURUS_OR_ABOVE as readonly string[]).includes(user.role) : false

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Button variant="ghost" size="sm" onClick={() => router.back()}>
        <ArrowLeft className="mr-2 h-4 w-4" /> Kembali
      </Button>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <CardTitle className="text-xl">{task.title}</CardTitle>
            <StatusBadge status={task.status} />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
            <span className="rounded bg-secondary px-2 py-1">{TASK_TYPE_LABELS[task.type] ?? task.type}</span>
            <span>Bobot {task.weight}</span>
            {task.due_date && (
              <span className="flex items-center gap-1">
                <Calendar className="h-4 w-4" /> Deadline {formatDate(task.due_date)}
              </span>
            )}
            {task.project && (
              <Link href={`/projects/${task.project.id}`} className="text-primary hover:underline">
                {task.project.title}
              </Link>
            )}
          </div>
          {task.description && <p className="whitespace-pre-wrap text-sm">{task.description}</p>}
          {task.assignee && (
            <p className="text-sm text-muted-foreground">
              Ditugaskan ke <span className="font-medium text-foreground">{task.assignee.full_name}</span>
              {task.assigner && <> oleh {task.assigner.full_name}</>}
            </p>
          )}
          {task.completed_at && (
            <p className="text-sm text-muted-foreground">Selesai: {formatDateTime(task.completed_at)}</p>
          )}
          {task.notes && (
            <div className="rounded-lg bg-secondary/50 p-3">
              <p className="text-xs font-semibold text-muted-foreground">Catatan submit</p>
              <p className="mt-1 whitespace-pre-wrap text-sm">{task.notes}</p>
            </div>
          )}
          {task.attachments.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-semibold text-muted-foreground">Lampiran</p>
              {task.attachments.map((a, i) => (
                <a key={i} href={a.url} target="_blank" rel="noreferrer"
                  className="flex items-center gap-2 text-sm text-primary hover:underline">
                  <FileText className="h-4 w-4" /> {a.name}
                </a>
              ))}
            </div>
          )}

          <Separator />

          <div className="flex flex-wrap gap-2">
            {isAssignee && task.status === 'pending' && (
              <Button onClick={() => updateStatus.mutate({ id: task.id, status: 'in_progress' })}>
                Mulai Kerjakan
              </Button>
            )}
            {isAssignee && ['pending', 'in_progress', 'revision'].includes(task.status) && (
              <Button asChild variant={task.status === 'pending' ? 'outline' : 'default'}>
                <Link href={`/tasks/${task.id}/submit`}>
                  <Send className="mr-2 h-4 w-4" /> Submit Hasil
                </Link>
              </Button>
            )}
            {isManager && task.status === 'review' && (
              <>
                <Button onClick={() => updateStatus.mutate({ id: task.id, status: 'completed' })}>
                  Approve
                </Button>
                <Button variant="outline" onClick={() => updateStatus.mutate({ id: task.id, status: 'revision' })}>
                  Minta Revisi
                </Button>
              </>
            )}
            {isManager && !['completed', 'cancelled'].includes(task.status) && (
              <Button variant="destructive" size="sm"
                onClick={() => updateStatus.mutate({ id: task.id, status: 'cancelled' })}>
                Batalkan
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <TaskComments taskId={task.id} comments={task.comments} />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <TaskHistoryTimeline history={task.history} />
        </CardContent>
      </Card>
    </div>
  )
}
