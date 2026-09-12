'use client'

import { use } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, MapPin, Video, Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { LoadingSkeleton } from '@/components/ui/loading-skeleton'
import { CheckInButton } from '@/components/meetings/checkin-button'
import { AttendanceTable } from '@/components/meetings/attendance-table'
import { useMeetings, useAttendance, useCloseMeeting } from '@/hooks/use-meetings'
import { useUser } from '@/hooks/use-user'
import { formatDateTime } from '@/lib/utils'
import { PENGURUS_OR_ABOVE, MEETING_TYPE_LABELS } from '@jurnalis-org/shared/constants'

export default function MeetingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const { data: meetings, isLoading } = useMeetings()
  const { data: attendance } = useAttendance(id)
  const { data: user } = useUser()
  const closeMeeting = useCloseMeeting()

  const meeting = meetings?.data.find((m) => m.id === id)
  if (isLoading || !meeting) return <LoadingSkeleton rows={4} />

  const myStatus = attendance?.data.find((a) => a.profile.id === user?.id)?.status
  const canManage = user ? (PENGURUS_OR_ABOVE as readonly string[]).includes(user.role) : false

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Button variant="ghost" size="sm" onClick={() => router.back()}>
        <ArrowLeft className="mr-2 h-4 w-4" /> Kembali
      </Button>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="text-xl">{meeting.title}</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">{formatDateTime(meeting.start_time)}</p>
            </div>
            <div className="flex gap-2">
              <Badge variant="secondary">{MEETING_TYPE_LABELS[meeting.type] ?? meeting.type}</Badge>
              {meeting.is_mandatory && <Badge variant="destructive">Wajib</Badge>}
              {meeting.is_closed && <Badge variant="outline"><Lock className="mr-1 h-3 w-3" />Ditutup</Badge>}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {meeting.description && <p className="whitespace-pre-wrap text-sm">{meeting.description}</p>}
          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
            {meeting.location && (
              <span className="flex items-center gap-1"><MapPin className="h-4 w-4" />{meeting.location}</span>
            )}
            {meeting.link && (
              <a href={meeting.link} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-primary hover:underline">
                <Video className="h-4 w-4" />Join Online
              </a>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {!meeting.is_closed && <CheckInButton meetingId={meeting.id} myStatus={myStatus} />}
            {canManage && !meeting.is_closed && (
              <Button variant="outline" onClick={() => closeMeeting.mutate(meeting.id)}>
                Tutup Absensi
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <AttendanceTable meetingId={meeting.id} />
        </CardContent>
      </Card>
    </div>
  )
}
