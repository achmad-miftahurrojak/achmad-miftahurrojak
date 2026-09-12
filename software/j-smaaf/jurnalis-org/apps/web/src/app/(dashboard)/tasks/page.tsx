'use client'

import { Suspense, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Plus } from 'lucide-react'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { LoadingSkeleton } from '@/components/ui/loading-skeleton'
import { ListTodo } from 'lucide-react'
import { TaskCard } from '@/components/tasks/task-card'
import { AssignTaskForm } from '@/components/projects/assign-task-form'
import { useTasks } from '@/hooks/use-tasks'
import { useUser } from '@/hooks/use-user'
import { PENGURUS_OR_ABOVE } from '@jurnalis-org/shared/constants'

const TABS = [
  { value: 'all', label: 'Semua' },
  { value: 'pending', label: 'Menunggu' },
  { value: 'in_progress', label: 'Dikerjakan' },
  { value: 'review', label: 'Review' },
  { value: 'completed', label: 'Selesai' },
]

function TasksContent() {
  const searchParams = useSearchParams()
  const [page, setPage] = useState(Number(searchParams.get('page') ?? 1))
  const [status, setStatus] = useState<string>('all')
  const [assignOpen, setAssignOpen] = useState(false)
  const { data: user } = useUser()
  const { data, isLoading } = useTasks(page, status === 'all' ? undefined : status)
  const canAssign = user ? (PENGURUS_OR_ABOVE as readonly string[]).includes(user.role) : false

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Tugas</h1>
        {canAssign && (
          <Button onClick={() => setAssignOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> Tugas Baru
          </Button>
        )}
      </div>

      <Tabs value={status} onValueChange={(v) => { setStatus(v); setPage(1) }}>
        <TabsList className="w-full justify-start overflow-x-auto">
          {TABS.map((t) => (
            <TabsTrigger key={t.value} value={t.value}>{t.label}</TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {isLoading ? (
        <LoadingSkeleton rows={4} />
      ) : !data || data.data.length === 0 ? (
        <EmptyState icon={ListTodo} title="Tidak ada tugas" description="Tugas yang diberikan padamu akan muncul di sini." />
      ) : (
        <>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {data.data.map((t) => <TaskCard key={t.id} task={t} />)}
          </div>
          {data.meta.totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Sebelumnya</Button>
              <span className="text-sm text-muted-foreground">Halaman {page} dari {data.meta.totalPages}</span>
              <Button variant="outline" size="sm" disabled={page >= data.meta.totalPages} onClick={() => setPage(page + 1)}>Berikutnya</Button>
            </div>
          )}
        </>
      )}
      <AssignTaskForm open={assignOpen} onOpenChange={setAssignOpen} />
    </div>
  )
}

export default function TasksPage() {
  return (
    <Suspense fallback={<LoadingSkeleton rows={4} />}>
      <TasksContent />
    </Suspense>
  )
}
