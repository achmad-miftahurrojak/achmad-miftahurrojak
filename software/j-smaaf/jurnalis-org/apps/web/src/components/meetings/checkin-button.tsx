'use client'

import { useState } from 'react'
import { MapPin } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { useCheckIn } from '@/hooks/use-meetings'
import { ATTENDANCE_STATUS_LABELS } from '@jurnalis-org/shared/constants'

export function CheckInButton({ meetingId, myStatus }: { meetingId: string; myStatus?: string | null }) {
  const [open, setOpen] = useState(false)
  const [status, setStatus] = useState<string>('hadir')
  const [notes, setNotes] = useState('')
  const checkIn = useCheckIn(meetingId)

  if (myStatus) {
    return (
      <Button variant="outline" disabled>
        Sudah absen: {ATTENDANCE_STATUS_LABELS[myStatus] ?? myStatus}
      </Button>
    )
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <MapPin className="mr-2 h-4 w-4" /> Check-in
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Absensi</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(ATTENDANCE_STATUS_LABELS).map(([v, l]) => (
                    <SelectItem key={v} value={v}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {status === 'hadir' && (
                <p className="text-xs text-muted-foreground">
                  Check-in hadir hanya bisa 30 menit sebelum sampai 30 menit setelah kegiatan dimulai.
                </p>
              )}
            </div>
            {status !== 'hadir' && (
              <div className="space-y-2">
                <Label>Keterangan</Label>
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
                  placeholder="Alasan izin/sakit..." />
              </div>
            )}
            <Button className="w-full" disabled={checkIn.isPending}
              onClick={() => checkIn.mutate(
                { status: status as 'hadir' | 'izin' | 'sakit' | 'alpha', notes: notes || null },
                { onSuccess: () => setOpen(false) },
              )}>
              {checkIn.isPending ? 'Menyimpan...' : 'Simpan'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
