'use client'

import { useRouter } from 'next/navigation'
import { RefreshCw, Trophy } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { LoadingSkeleton } from '@/components/ui/loading-skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import { UserAvatar } from '@/components/ui/user-avatar'
import { usePerformance, useRecalculatePerformance } from '@/hooks/use-performance'
import { useUser } from '@/hooks/use-user'
import { formatDate } from '@/lib/utils'
import { PENGURUS_OR_ABOVE } from '@jurnalis-org/shared/constants'

export default function PerformancePage() {
  const router = useRouter()
  const { data, isLoading } = usePerformance()
  const { data: user } = useUser()
  const recalculate = useRecalculatePerformance()
  const canRecalc = user ? (PENGURUS_OR_ABOVE as readonly string[]).includes(user.role) : false

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Leaderboard Kinerja</h1>
          {data?.period && (
            <p className="text-sm text-muted-foreground">
              {data.period.name} ({formatDate(data.period.start_date)} – {formatDate(data.period.end_date)})
            </p>
          )}
        </div>
        {canRecalc && (
          <Button variant="outline" size="sm" onClick={() => recalculate.mutate()} disabled={recalculate.isPending}>
            <RefreshCw className={`mr-2 h-4 w-4 ${recalculate.isPending ? 'animate-spin' : ''}`} />
            Hitung Ulang
          </Button>
        )}
      </div>

      {isLoading ? (
        <LoadingSkeleton rows={4} />
      ) : !data || data.records.length === 0 ? (
        <EmptyState icon={Trophy} title="Belum ada data kinerja"
          description={canRecalc ? 'Klik "Hitung Ulang" untuk menghitung skor periode aktif.' : 'Skor kinerja akan muncul setelah dihitung pengurus.'} />
      ) : (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Peringkat ({data.records.length} anggota)</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>Nama</TableHead>
                    <TableHead className="text-center">Tugas</TableHead>
                    <TableHead className="text-center">Tepat Waktu</TableHead>
                    <TableHead className="text-center">Hadir</TableHead>
                    <TableHead className="text-center">Konten</TableHead>
                    <TableHead className="text-right">Skor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.records.map((r, i) => (
                    <TableRow key={r.id} className="cursor-pointer"
                      onClick={() => router.push(`/performance/${r.profile_id}`)}>
                      <TableCell className="font-bold">
                        {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <UserAvatar name={r.profile.full_name} url={r.profile.avatar_url} className="h-7 w-7" />
                          <div>
                            <p className="text-sm font-medium">{r.profile.full_name}</p>
                            <p className="text-xs text-muted-foreground">{r.profile.division ?? '-'}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-center text-sm">{r.tasks_completed}</TableCell>
                      <TableCell className="text-center text-sm">
                        {r.tasks_completed > 0 ? `${Math.round((r.tasks_on_time / r.tasks_completed) * 100)}%` : '-'}
                      </TableCell>
                      <TableCell className="text-center text-sm">{r.attendance_hadir}/{r.attendance_total}</TableCell>
                      <TableCell className="text-center text-sm">{r.content_published}</TableCell>
                      <TableCell className="text-right text-sm font-bold text-primary">
                        {r.overall_score.toFixed(1)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
