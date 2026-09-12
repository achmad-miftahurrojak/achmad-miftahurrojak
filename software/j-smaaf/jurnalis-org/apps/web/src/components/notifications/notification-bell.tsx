'use client'

import Link from 'next/link'
import { Bell } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { NotificationItemRow } from './notification-item'
import {
  useNotifications, useUnreadCount, useMarkAllRead, useNotificationSubscription,
} from '@/hooks/use-notifications'

export function NotificationBell() {
  useNotificationSubscription()
  const { data: unread } = useUnreadCount()
  const { data } = useNotifications()
  const markAll = useMarkAllRead()

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {(unread?.count ?? 0) > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
              {unread!.count > 99 ? '99+' : unread!.count}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b px-4 py-2">
          <p className="text-sm font-semibold">Notifikasi</p>
          <Button variant="ghost" size="sm" className="text-xs" onClick={() => markAll.mutate()}>
            Tandai semua dibaca
          </Button>
        </div>
        <ScrollArea className="h-80">
          {!data || data.data.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">Belum ada notifikasi</p>
          ) : (
            data.data.map((n) => <NotificationItemRow key={n.id} notification={n} />)
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  )
}
