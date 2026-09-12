'use client'

import Link from 'next/link'
import { Calendar } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { StatusBadge } from '@/components/ui/status-badge'
import { UserAvatar } from '@/components/ui/user-avatar'
import { formatDate } from '@/lib/utils'
import { TASK_TYPE_LABELS } from '@jurnalis-org/shared/constants'
import type { Task } from '@/hooks/use-tasks'

export function TaskCard({ task, href }: { task: Task; href?: string }) {
  const isOverdue = task.due_date && new Date(task.due_date) < new Date() && !['completed', 'cancelled'].includes(task.status)
  return (
    <Link href={href ?? `/tasks/${task.id}`}>
      <Card className="transition-shadow hover:shadow-md">
        <CardContent className="space-y-2 p-4">
          <div className="flex items-start justify-between gap-2">
            <p className="line-clamp-2 text-sm font-medium">{task.title}</p>
            <StatusBadge status={task.status} />
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="rounded bg-secondary px-1.5 py-0.5">{TASK_TYPE_LABELS[task.type] ?? task.type}</span>
            <span>Bobot {task.weight}</span>
            {task.project && <span className="truncate">· {task.project.title}</span>}
          </div>
          <div className="flex items-center justify-between">
            {task.assignee ? (
              <div className="flex items-center gap-1.5">
                <UserAvatar name={task.assignee.full_name} url={task.assignee.avatar_url} className="h-5 w-5" />
                <span className="text-xs text-muted-foreground">{task.assignee.full_name}</span>
              </div>
            ) : (
              <span className="text-xs text-muted-foreground">Belum ditugaskan</span>
            )}
            {task.due_date && (
              <span className={`flex items-center gap-1 text-xs ${isOverdue ? 'font-medium text-destructive' : 'text-muted-foreground'}`}>
                <Calendar className="h-3 w-3" />
                {formatDate(task.due_date)}
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
