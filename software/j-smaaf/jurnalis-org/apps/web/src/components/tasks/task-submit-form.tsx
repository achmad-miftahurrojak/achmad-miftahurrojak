'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { FileUpload, type UploadedFile } from '@/components/ui/file-upload'
import { useSubmitTask } from '@/hooks/use-tasks'

export function TaskSubmitForm({ taskId }: { taskId: string }) {
  const router = useRouter()
  const [notes, setNotes] = useState('')
  const [attachments, setAttachments] = useState<UploadedFile[]>([])
  const submit = useSubmitTask(taskId)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    submit.mutate(
      { notes: notes || null, attachments },
      { onSuccess: () => router.push(`/tasks/${taskId}`) },
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="notes">Catatan Hasil</Label>
        <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)}
          placeholder="Jelaskan hasil pekerjaanmu..." rows={4} />
      </div>
      <div className="space-y-2">
        <Label>Lampiran</Label>
        <FileUpload bucket="private" folder={`tasks/${taskId}`} multiple onChange={setAttachments} />
      </div>
      <Button type="submit" disabled={submit.isPending}>
        {submit.isPending ? 'Mengirim...' : 'Submit untuk Review'}
      </Button>
    </form>
  )
}
