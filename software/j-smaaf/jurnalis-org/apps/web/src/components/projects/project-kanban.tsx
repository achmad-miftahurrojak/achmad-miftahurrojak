'use client'

import { useState } from 'react'
import {
  DndContext, DragOverlay, PointerSensor, useSensor, useSensors,
  useDroppable, useDraggable, type DragStartEvent, type DragEndEvent,
} from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { Card, CardContent } from '@/components/ui/card'
import { useUpdateTaskStatusInProject } from '@/hooks/use-projects'
import { useUser } from '@/hooks/use-user'
import { PENGURUS_OR_ABOVE, TASK_STATUS_LABELS } from '@jurnalis-org/shared/constants'
import type { Task } from '@/hooks/use-tasks'

const COLUMNS = ['pending', 'in_progress', 'review', 'revision', 'completed'] as const

function DraggableTask({ task, disabled }: { task: Task; disabled: boolean }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: task.id, disabled })
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Translate.toString(transform) }} {...attributes} {...listeners}>
      <Card className={isDragging ? 'opacity-40' : 'cursor-grab'}>
        <CardContent className="space-y-1 p-3">
          <p className="text-sm font-medium">{task.title}</p>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{task.assignee?.full_name ?? 'Belum ditugaskan'}</span>
            <span>Bobot {task.weight}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function DroppableColumn({ status, children }: { status: string; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: status })
  return (
    <div ref={setNodeRef} className={`min-h-[200px] flex-1 space-y-2 rounded-lg border bg-secondary/30 p-2 ${isOver ? 'ring-2 ring-primary' : ''}`}>
      <p className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {TASK_STATUS_LABELS[status] ?? status}
      </p>
      {children}
    </div>
  )
}

export function ProjectKanban({ tasks, projectId }: { tasks: Task[]; projectId: string }) {
  const [activeTask, setActiveTask] = useState<Task | null>(null)
  const updateStatus = useUpdateTaskStatusInProject(projectId)
  const { data: user } = useUser()
  const canDrag = user ? (PENGURUS_OR_ABOVE as readonly string[]).includes(user.role) : false
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  function handleDragStart(event: DragStartEvent) {
    setActiveTask(tasks.find((t) => t.id === event.active.id) ?? null)
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveTask(null)
    const taskId = String(event.active.id)
    const newStatus = event.over?.id as string | undefined
    const task = tasks.find((t) => t.id === taskId)
    if (!task || !newStatus || task.status === newStatus) return
    updateStatus.mutate({ id: taskId, status: newStatus })
  }

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex gap-3 overflow-x-auto pb-2">
        {COLUMNS.map((status) => (
          <DroppableColumn key={status} status={status}>
            {tasks.filter((t) => t.status === status).map((t) => (
              <DraggableTask key={t.id} task={t} disabled={!canDrag} />
            ))}
          </DroppableColumn>
        ))}
      </div>
      <DragOverlay>
        {activeTask && (
          <Card>
            <CardContent className="p-3">
              <p className="text-sm font-medium">{activeTask.title}</p>
            </CardContent>
          </Card>
        )}
      </DragOverlay>
    </DndContext>
  )
}
