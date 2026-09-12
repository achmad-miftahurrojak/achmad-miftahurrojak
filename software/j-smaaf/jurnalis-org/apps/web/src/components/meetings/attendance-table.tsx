'use client'

import { Download } from 'lucide-react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/ui/status-badge'
import { UserAvatar } from '@/components/ui/user-avatar'
import { useAttendance, useMarkAttendance } from '@/hooks/use-meetings'
import { useUser } from '@/hooks/use-user'
import { apiFetch } from '@/lib/api-client'
import { toast } from 'sonner'
import { PENGURUS_OR_ABOVE, ATTENDANCE_STATUS_LABELS } from '@jurnalis-org/shared/constants'

export function AttendanceTable({ meetingId }: { meetingId: string }) {
  const { data } = useAttendance(meetingId)
  const { data: user } = useUser()
  const markAttendance = useMarkAttendance(meetingId)
  const canMark = user ? (PENGURUS_OR_ABOVE as readonly string[]).includes(user.role) : false

  async function handleExport() {
    const res = await apiFetch(`/api/meetings/${meetingId}/attendance/export`)
    if (!res.ok) {
      toast.error('Export gagal')
      return
    }
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'absensi.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Kehadiran ({data?.data.length ?? 0})</h3>
        {canMark && (
          <Button variant="outline" size="sm" onClick={() => void handleExport()}>
            <Download className="mr-2 h-4 w-4" /> Export CSV
          </Button>
        )}
      </div>
      {!data || data.data.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">Belum ada yang absen</p>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nama</TableHead>
                <TableHead>Divisi</TableHead>
                <TableHead>Status</TableHead>
                {canMark && <TableHead className="w-32">Ubah</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.data.map((a) => (
                <TableRow key={a.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <UserAvatar name={a.profile.full_name} url={a.profile.avatar_url} className="h-6 w-6" />
                      <span className="text-sm">{a.profile.full_name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{a.profile.division ?? '-'}</TableCell>
                  <TableCell><StatusBadge status={a.status} /></TableCell>
                  {canMark && (
                    <TableCell>
                      <Select
                        value={a.status}
                        onValueChange={(status) => markAttendance.mutate({ userId: a.profile.id, status })}
                      >
                        <SelectTrigger className="h-8 w-28"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {Object.entries(ATTENDANCE_STATUS_LABELS).map(([v, l]) => (
                            <SelectItem key={v} value={v}>{l}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
