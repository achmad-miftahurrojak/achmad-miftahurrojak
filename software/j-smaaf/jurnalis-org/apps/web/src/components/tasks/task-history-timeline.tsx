import { formatDateTime } from '@/lib/utils'
import { TASK_STATUS_LABELS } from '@jurnalis-org/shared/constants'
import type { TaskHistoryEntry } from '@/hooks/use-tasks'

const ACTION_LABELS: Record<string, string> = {
  status_change: 'mengubah status',
  comment: 'menambahkan komentar',
  submit: 'submit tugas',
  assign: 'membuat tugas',
}

export function TaskHistoryTimeline({ history }: { history: TaskHistoryEntry[] }) {
  if (history.length === 0) return null
  return (
    <div className="space-y-3">
      <h3 className="font-semibold">Riwayat</h3>
      <ol className="relative space-y-3 border-l pl-5">
        {history.map((h) => (
          <li key={h.id} className="relative">
            <span className="absolute -left-[26px] top-1.5 h-2.5 w-2.5 rounded-full bg-primary" />
            <p className="text-sm">
              <span className="font-medium">{h.actor.full_name}</span>{' '}
              {ACTION_LABELS[h.action] ?? h.action}
              {h.from_value && h.to_value && (
                <>: {TASK_STATUS_LABELS[h.from_value] ?? h.from_value} → {TASK_STATUS_LABELS[h.to_value] ?? h.to_value}</>
              )}
            </p>
            {h.notes && <p className="text-xs text-muted-foreground">{h.notes}</p>}
            <p className="text-[10px] text-muted-foreground">{formatDateTime(h.created_at)}</p>
          </li>
        ))}
      </ol>
    </div>
  )
}
