'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { Eye, Heart, CheckCircle2, LogIn } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { LoadingSkeleton } from '@/components/ui/loading-skeleton'
import { useAnalyticsOverview } from '@/hooks/use-analytics'
import { useUser } from '@/hooks/use-user'
import { ANALYTICS_ACCESS } from '@jurnalis-org/shared/constants'

export default function AnalyticsPage() {
  const router = useRouter()
  const { data: user, isLoading: loadingUser } = useUser()
  const { data, isLoading } = useAnalyticsOverview()
  const canAccess = user ? (ANALYTICS_ACCESS as readonly string[]).includes(user.role) : false

  useEffect(() => {
    if (!loadingUser && user && !canAccess) {
      router.replace('/dashboard')
    }
  }, [user, loadingUser, canAccess, router])

  if (isLoading || loadingUser || !canAccess) return <LoadingSkeleton rows={4} />

  const totals = data?.totals ?? {}
  const cards = [
    { label: 'Views (7 hari)', value: totals.content_view ?? 0, icon: Eye },
    { label: 'Likes (7 hari)', value: totals.content_like ?? 0, icon: Heart },
    { label: 'Tugas Selesai (7 hari)', value: totals.task_completed ?? 0, icon: CheckCircle2 },
    { label: 'Login (7 hari)', value: totals.login ?? 0, icon: LogIn },
  ]

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Analytics</h1>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map((c) => (
          <Card key={c.label}>
            <CardContent className="p-4">
              <c.icon className="mb-2 h-5 w-5 text-primary/70" />
              <p className="text-2xl font-bold">{c.value}</p>
              <p className="text-xs text-muted-foreground">{c.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Views Konten per Hari</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={data?.viewsPerDay ?? []}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="views" fill="#2563eb" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Tugas Diselesaikan per Hari</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={data?.taskCompletions ?? []}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" fill="#16a34a" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Konten Terpopuler (7 hari)</CardTitle></CardHeader>
        <CardContent>
          {!data || data.topContent.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">Belum ada data views</p>
          ) : (
            <ol className="space-y-2">
              {data.topContent.map((c, i) => (
                <li key={c.id} className="flex items-center justify-between border-b pb-2 text-sm last:border-0">
                  <span><span className="mr-2 font-bold text-muted-foreground">{i + 1}.</span>{c.title}</span>
                  <span className="font-semibold text-primary">{c.views} views</span>
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
