'use client'

import { ChevronDown, ChevronUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useVotePitch } from '@/hooks/use-pitches'

export function VoteButtons({ pitchId, upvotes, downvotes, myVote }: {
  pitchId: string
  upvotes: number
  downvotes: number
  myVote: number
}) {
  const vote = useVotePitch()

  return (
    <div className="flex items-center gap-1">
      <Button variant={myVote === 1 ? 'default' : 'outline'} size="sm"
        onClick={(e) => { e.preventDefault(); vote.mutate({ id: pitchId, vote: 1 }) }}>
        <ChevronUp className="mr-1 h-4 w-4" />{upvotes}
      </Button>
      <Button variant={myVote === -1 ? 'destructive' : 'outline'} size="sm"
        onClick={(e) => { e.preventDefault(); vote.mutate({ id: pitchId, vote: -1 }) }}>
        <ChevronDown className="mr-1 h-4 w-4" />{downvotes}
      </Button>
    </div>
  )
}
