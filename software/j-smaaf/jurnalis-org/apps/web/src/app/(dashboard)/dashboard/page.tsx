'use client'

import Link from 'next/link'
import { ListTodo, CheckCircle2, CalendarDays, Newspaper, ArrowRight } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { LoadingSkeleton } from '@/components/ui/loading-skeleton'
import { TaskCard } from '@/components/tasks/task-card'
import { useUser } from '@/hooks/use-user'
import { useTasks } from '@/hooks/use-tasks'
import { useMeetings } from '@/hooks/use-meetings'
import { useContentList } from '@/hooks/use-content'
import { formatDateTime } from '@/lib/utils'

export default function DashboardPage() {
  const { data: user } = useUser()
  const { data: tasks, isLoading: loadingTasks } = useTasks(1)
  const { data: meetings } = useMeetings()
  const { data: content } = useContentList(1)

  const activeTasks = tasks?.data.filter((t) => !['completed', 'cancelled'].includes(t.status)) ?? []
  const doneTasks = tasks?.data.filter((t) => t.status === 'completed') ?? []
  const upcoming = (meetings?.data ?? []).filter((m) => new Date(m.start_time) >= new Date()).slice(0, 3)

  const stats = [
    { label: 'Tugas Aktif', value: activeTasks.length, icon: ListTodo },
    { label: 'Tugas Selesai', value: doneTasks.length, icon: CheckCircle2 },
    { label: 'Kegiatan Terdekat', value: upcoming.length, icon: CalendarDays },
    { label: 'Konten Saya', value: content?.meta.total ?? 0, icon: Newspaper },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Halo, {user?.nickname ?? user?.full_name ?? '...'}</h1>
        <p className="text-sm text-muted-foreground">Selamat datang kembali di Jurnalis Org</p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardContent className="flex items-center gap-3 p-4">
              <s.icon className="h-8 w-8 text-primary/70" />
              <div>
                <p className="text-2xl font-bold">{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base">Tugas Aktif Saya</CardTitle>
            <Link href="/tasks" className="flex items-center gap-1 text-sm text-primary hover:underline">
              Lihat semua <ArrowRight className="h-3 w-3" />
            </Link>
          </CardHeader>
          <CardContent className="space-y-3">
            {loadingTasks ? (
              <LoadingSkeleton rows={2} />
            ) : activeTasks.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Tidak ada tugas aktif. Santai dulu!</p>
            ) : (
              activeTasks.slice(0, 3).map((t) => <TaskCard key={t.id} task={t} />)
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base">Kegiatan Terdekat</CardTitle>
            <Link href="/schedule" className="flex items-center gap-1 text-sm text-primary hover:underline">
              Lihat semua <ArrowRight className="h-3 w-3" />
            </Link>
          </CardHeader>
          <CardContent className="space-y-3">
            {upcoming.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Belum ada kegiatan terjadwal</p>
            ) : (
              upcoming.map((m) => (
                <Link key={m.id} href={`/schedule/${m.id}`} className="block rounded-lg border p-3 transition-colors hover:bg-accent">
                  <p className="text-sm font-medium">{m.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDateTime(m.start_time)}{m.location ? ` · ${m.location}` : ''}
                  </p>
                </Link>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
