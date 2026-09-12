'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { UserAvatar } from '@/components/ui/user-avatar'
import { formatDateTime } from '@/lib/utils'
import { useAddComment, type TaskComment } from '@/hooks/use-tasks'

export function TaskComments({ taskId, comments }: { taskId: string; comments: TaskComment[] }) {
  const [content, setContent] = useState('')
  const addComment = useAddComment(taskId)

  function handleSubmit() {
    if (!content.trim()) return
    addComment.mutate(content, { onSuccess: () => setContent('') })
  }

  return (
    <div className="space-y-4">
      <h3 className="font-semibold">Komentar ({comments.length})</h3>
      <div className="space-y-3">
        {comments.map((c) => (
          <div key={c.id} className="flex gap-3">
            <UserAvatar name={c.author.full_name} url={c.author.avatar_url} />
            <div className="flex-1 rounded-lg bg-secondary/50 px-3 py-2">
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-sm font-medium">{c.author.full_name}</p>
                <p className="text-[10px] text-muted-foreground">{formatDateTime(c.created_at)}</p>
              </div>
              <p className="mt-1 whitespace-pre-wrap text-sm">{c.content}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="space-y-2">
        <Textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="Tulis komentar..." rows={2} />
        <Button size="sm" onClick={handleSubmit} disabled={addComment.isPending || !content.trim()}>
          Kirim
        </Button>
      </div>
    </div>
  )
}
