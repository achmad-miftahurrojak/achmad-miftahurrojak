'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  DndContext, DragOverlay, PointerSensor, useSensor, useSensors,
  useDroppable, useDraggable, type DragStartEvent, type DragEndEvent,
} from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { Card, CardContent } from '@/components/ui/card'
import { CONTENT_CATEGORY_LABELS, EDITORIAL_STAGES } from '@jurnalis-org/shared/constants'
import { useUpdateContentStage, type ContentItem } from '@/hooks/use-content'

function DraggableCard({ item }: { item: ContentItem }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: item.id })
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Translate.toString(transform) }} {...attributes} {...listeners}>
      <Card className={isDragging ? 'opacity-40' : 'cursor-grab'}>
        <CardContent className="space-y-1 p-3">
          <p className="line-clamp-2 text-sm font-medium">{item.title}</p>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="rounded bg-secondary px-1.5 py-0.5">{CONTENT_CATEGORY_LABELS[item.category] ?? item.category}</span>
            <span>{item.author?.full_name ?? '-'}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function StageColumn({ stage, items }: { stage: string; items: ContentItem[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: stage })
  return (
    <div ref={setNodeRef}
      className={`min-h-[300px] w-64 shrink-0 space-y-2 rounded-lg border bg-secondary/30 p-2 ${isOver ? 'ring-2 ring-primary' : ''}`}>
      <p className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {EDITORIAL_STAGES.find((s) => s.value === stage)?.label ?? stage} ({items.length})
      </p>
      {items.map((item) => (
        <Link key={item.id} href={`/content/${item.id}`} onClick={(e) => e.stopPropagation()}>
          <DraggableCard item={item} />
        </Link>
      ))}
    </div>
  )
}

export function EditorialBoard({ items }: { items: ContentItem[] }) {
  const [active, setActive] = useState<ContentItem | null>(null)
  const updateStage = useUpdateContentStage()
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  function handleDragStart(event: DragStartEvent) {
    setActive(items.find((i) => i.id === event.active.id) ?? null)
  }

  function handleDragEnd(event: DragEndEvent) {
    setActive(null)
    const itemId = String(event.active.id)
    const newStage = event.over?.id as string | undefined
    const item = items.find((i) => i.id === itemId)
    if (!item || !newStage || item.status === newStage) return
    updateStage.mutate({ id: itemId, status: newStage })
  }

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex gap-3 overflow-x-auto pb-2">
        {EDITORIAL_STAGES.map((stage) => (
          <StageColumn key={stage.value} stage={stage.value}
            items={items.filter((i) => i.status === stage.value)} />
        ))}
      </div>
      <DragOverlay>
        {active && (
          <Card>
            <CardContent className="p-3">
              <p className="text-sm font-medium">{active.title}</p>
            </CardContent>
          </Card>
        )}
      </DragOverlay>
    </DndContext>
  )
}
