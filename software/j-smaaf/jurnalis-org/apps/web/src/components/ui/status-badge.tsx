import { Badge } from '@/components/ui/badge'
import { TASK_STATUS_LABELS, CONTENT_STATUS_LABELS, FINANCE_STATUS_LABELS, ATTENDANCE_STATUS_LABELS } from '@jurnalis-org/shared/constants'

const STATUS_VARIANTS: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  pending: 'outline',
  in_progress: 'default',
  review: 'secondary',
  revision: 'destructive',
  completed: 'default',
  cancelled: 'destructive',
  draft: 'outline',
  published: 'default',
  archived: 'secondary',
  approved: 'default',
  rejected: 'destructive',
  hadir: 'default',
  izin: 'secondary',
  sakit: 'secondary',
  alpha: 'destructive',
}

const ALL_LABELS: Record<string, string> = {
  ...TASK_STATUS_LABELS, ...CONTENT_STATUS_LABELS, ...FINANCE_STATUS_LABELS, ...ATTENDANCE_STATUS_LABELS,
}

export function StatusBadge({ status }: { status: string }) {
  return (
    <Badge variant={STATUS_VARIANTS[status] ?? 'outline'} className="text-[11px]">
      {ALL_LABELS[status] ?? status}
    </Badge>
  )
}
