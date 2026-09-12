'use client'

import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { formatDateTime } from '@/lib/utils'
import { useMarkRead, type NotificationItem } from '@/hooks/use-notifications'

export function NotificationItemRow({ notification }: { notification: NotificationItem }) {
  const router = useRouter()
  const markRead = useMarkRead()
  const url = typeof notification.data?.url === 'string' ? notification.data.url : null

  function handleClick() {
    if (!notification.read_at) markRead.mutate(notification.id)
    if (url) router.push(url)
  }

  return (
    <button
      onClick={handleClick}
      className={cn(
        'block w-full border-b px-4 py-3 text-left transition-colors hover:bg-accent',
        !notification.read_at && 'bg-primary/5',
      )}
    >
      <p className="text-sm font-medium">{notification.title}</p>
      <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{notification.message}</p>
      <p className="mt-1 text-[10px] text-muted-foreground">{formatDateTime(notification.created_at)}</p>
    </button>
  )
}
