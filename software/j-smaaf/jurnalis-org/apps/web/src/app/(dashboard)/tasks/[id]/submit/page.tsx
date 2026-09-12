'use client'

import { use } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { LoadingSkeleton } from '@/components/ui/loading-skeleton'
import { TaskSubmitForm } from '@/components/tasks/task-submit-form'
import { useTask } from '@/hooks/use-tasks'

export default function TaskSubmitPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const { data: task, isLoading } = useTask(id)

  if (isLoading || !task) return <LoadingSkeleton rows={4} />

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <Button variant="ghost" size="sm" onClick={() => router.back()}>
        <ArrowLeft className="mr-2 h-4 w-4" /> Kembali
      </Button>
      <Card>
        <CardHeader>
          <CardTitle>Submit: {task.title}</CardTitle>
        </CardHeader>
        <CardContent>
          <TaskSubmitForm taskId={task.id} />
        </CardContent>
      </Card>
    </div>
  )
}
