'use client'

import { useState } from 'react'
import Link from 'next/link'
import { CalendarDays, Plus, MapPin, Video } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { LoadingSkeleton } from '@/components/ui/loading-skeleton'
import { useMeetings } from '@/hooks/use-meetings'
import { useUser } from '@/hooks/use-user'
import { formatDateTime } from '@/lib/utils'
import { PENGURUS_OR_ABOVE, MEETING_TYPE_LABELS } from '@jurnalis-org/shared/constants'

export default function SchedulePage() {
  const { data, isLoading } = useMeetings()
  const { data: user } = useUser()
  const canCreate = user ? (PENGURUS_OR_ABOVE as readonly string[]).includes(user.role) : false
  const now = new Date()
  const [showPast, setShowPast] = useState(false)

  const all = data?.data ?? []
  const upcoming = all.filter((m) => new Date(m.start_time) >= now)
  const past = all.filter((m) => new Date(m.start_time) < now).reverse()
  const shown = showPast ? past : upcoming

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Jadwal & Absensi</h1>
        {canCreate && (
          <Button asChild>
            <Link href="/schedule/new"><Plus className="mr-2 h-4 w-4" /> Kegiatan Baru</Link>
          </Button>
        )}
      </div>

      <div className="flex gap-2">
        <Button variant={!showPast ? 'default' : 'outline'} size="sm" onClick={() => setShowPast(false)}>
          Akan Datang ({upcoming.length})
        </Button>
        <Button variant={showPast ? 'default' : 'outline'} size="sm" onClick={() => setShowPast(true)}>
          Riwayat ({past.length})
        </Button>
      </div>

      {isLoading ? (
        <LoadingSkeleton rows={3} />
      ) : shown.length === 0 ? (
        <EmptyState icon={CalendarDays}
          title={showPast ? 'Belum ada riwayat' : 'Belum ada kegiatan'}
          description="Kegiatan yang dijadwalkan pengurus akan muncul di sini." />
      ) : (
        <div className="space-y-3">
          {shown.map((m) => (
            <Link key={m.id} href={`/schedule/${m.id}`}>
              <Card className="transition-shadow hover:shadow-md">
                <CardContent className="flex items-center gap-4 p-4">
                  <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <span className="text-lg font-bold leading-none">{new Date(m.start_time).getDate()}</span>
                    <span className="text-[10px] uppercase">
                      {new Date(m.start_time).toLocaleDateString('id-ID', { month: 'short' })}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate font-medium">{m.title}</p>
                      <Badge variant="secondary" className="text-[10px]">{MEETING_TYPE_LABELS[m.type] ?? m.type}</Badge>
                      {m.is_mandatory && <Badge variant="destructive" className="text-[10px]">Wajib</Badge>}
                    </div>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs text-muted-foreground">
                      <span>{formatDateTime(m.start_time)}</span>
                      {m.location && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{m.location}</span>}
                      {m.link && <span className="flex items-center gap-1"><Video className="h-3 w-3" />Online</span>}
                    </p>
                  </div>
                  <div className="text-right text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">{m.hadir_count}</span> hadir
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
