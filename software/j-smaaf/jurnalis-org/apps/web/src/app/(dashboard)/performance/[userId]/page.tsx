'use client'

import { use } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { LoadingSkeleton } from '@/components/ui/loading-skeleton'
import { useMyPerformance } from '@/hooks/use-performance'
import { formatDate } from '@/lib/utils'

export default function UserPerformancePage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = use(params)
  const router = useRouter()
  const { data, isLoading } = useMyPerformance(userId)

  if (isLoading) return <LoadingSkeleton rows={3} />

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Button variant="ghost" size="sm" onClick={() => router.back()}>
        <ArrowLeft className="mr-2 h-4 w-4" /> Kembali
      </Button>
      <h1 className="text-2xl font-bold">Riwayat Kinerja</h1>
      {!data || data.records.length === 0 ? (
        <p className="text-muted-foreground">Belum ada catatan kinerja.</p>
      ) : (
        data.records.map((r) => (
          <Card key={r.id}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{r.period.name}</CardTitle>
                <span className="text-2xl font-bold text-primary">{r.overall_score.toFixed(1)}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                {formatDate(r.period.start_date)} – {formatDate(r.period.end_date)}
              </p>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                <div className="rounded-lg bg-secondary/50 p-3 text-center">
                  <p className="text-lg font-bold">{r.tasks_completed}</p>
                  <p className="text-xs text-muted-foreground">Tugas selesai</p>
                </div>
                <div className="rounded-lg bg-secondary/50 p-3 text-center">
                  <p className="text-lg font-bold">{r.total_weight}</p>
                  <p className="text-xs text-muted-foreground">Total bobot</p>
                </div>
                <div className="rounded-lg bg-secondary/50 p-3 text-center">
                  <p className="text-lg font-bold">{r.attendance_hadir}/{r.attendance_total}</p>
                  <p className="text-xs text-muted-foreground">Kehadiran</p>
                </div>
                <div className="rounded-lg bg-secondary/50 p-3 text-center">
                  <p className="text-lg font-bold">{r.content_published}</p>
                  <p className="text-xs text-muted-foreground">Konten terbit</p>
                </div>
              </div>
              {r.tasks_late > 0 && (
                <p className="mt-3 text-xs text-destructive">{r.tasks_late} tugas terlambat diselesaikan</p>
              )}
            </CardContent>
          </Card>
        ))
      )}
    </div>
  )
}
