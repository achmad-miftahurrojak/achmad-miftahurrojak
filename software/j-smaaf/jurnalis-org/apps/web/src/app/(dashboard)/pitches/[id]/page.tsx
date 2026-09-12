'use client'

import { use } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { LoadingSkeleton } from '@/components/ui/loading-skeleton'
import { VoteButtons } from '@/components/pitches/vote-buttons'
import { UserAvatar } from '@/components/ui/user-avatar'
import { usePitch, useUpdatePitchStatus } from '@/hooks/use-pitches'
import { useUser } from '@/hooks/use-user'
import { formatDate } from '@/lib/utils'
import { ADMIN_OR_KETUA } from '@jurnalis-org/shared/constants'

export default function PitchDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const { data: pitch, isLoading } = usePitch(id)
  const { data: user } = useUser()
  const updateStatus = useUpdatePitchStatus()

  if (isLoading || !pitch) return <LoadingSkeleton rows={4} />
  const isAdmin = user ? (ADMIN_OR_KETUA as readonly string[]).includes(user.role) : false

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Button variant="ghost" size="sm" onClick={() => router.back()}>
        <ArrowLeft className="mr-2 h-4 w-4" /> Kembali
      </Button>
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <CardTitle className="text-xl">{pitch.title}</CardTitle>
            <Badge variant="secondary">{pitch.status}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            {pitch.author && (
              <>
                <UserAvatar name={pitch.author.full_name} url={pitch.author.avatar_url} className="h-6 w-6" />
                <span>{pitch.author.full_name}</span>
                <span>·</span>
              </>
            )}
            <span>{formatDate(pitch.created_at)}</span>
          </div>
          <p className="whitespace-pre-wrap text-sm">{pitch.description}</p>
          {(pitch.estimated_effort || pitch.expected_impact) && (
            <div className="grid gap-3 rounded-lg bg-secondary/50 p-3 text-sm sm:grid-cols-2">
              {pitch.estimated_effort && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground">Estimasi Effort</p>
                  <p>{pitch.estimated_effort}</p>
                </div>
              )}
              {pitch.expected_impact && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground">Dampak</p>
                  <p>{pitch.expected_impact}</p>
                </div>
              )}
            </div>
          )}
          <VoteButtons pitchId={pitch.id} upvotes={pitch.upvotes} downvotes={pitch.downvotes} myVote={pitch.my_vote} />
          {isAdmin && pitch.status === 'open' && (
            <div className="flex gap-2 border-t pt-4">
              <Button size="sm" onClick={() => updateStatus.mutate({ id: pitch.id, status: 'approved' })}>
                Setujui Ide
              </Button>
              <Button size="sm" variant="outline" onClick={() => updateStatus.mutate({ id: pitch.id, status: 'rejected' })}>
                Tolak
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
