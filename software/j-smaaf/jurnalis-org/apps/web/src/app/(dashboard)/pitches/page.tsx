'use client'

import { Suspense, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Lightbulb, Plus } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { LoadingSkeleton } from '@/components/ui/loading-skeleton'
import { VoteButtons } from '@/components/pitches/vote-buttons'
import { UserAvatar } from '@/components/ui/user-avatar'
import { usePitches } from '@/hooks/use-pitches'
import { formatDate } from '@/lib/utils'

const STATUS_LABELS: Record<string, string> = {
  open: 'Terbuka',
  draft: 'Draft',
  approved: 'Disetujui',
  rejected: 'Ditolak',
  archived: 'Arsip',
}

function PitchesContent() {
  const searchParams = useSearchParams()
  const [page, setPage] = useState(Number(searchParams.get('page') ?? 1))
  const { data, isLoading } = usePitches(page)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Pitch Board</h1>
          <p className="text-sm text-muted-foreground">Usulkan ide konten/proyek, vote ide terbaik</p>
        </div>
        <Button asChild>
          <Link href="/pitches/new"><Plus className="mr-2 h-4 w-4" /> Usulkan Ide</Link>
        </Button>
      </div>

      {isLoading ? (
        <LoadingSkeleton rows={4} />
      ) : !data || data.data.length === 0 ? (
        <EmptyState icon={Lightbulb} title="Belum ada ide" description="Jadi yang pertama mengusulkan ide!" />
      ) : (
        <>
          <div className="space-y-3">
            {data.data.map((p) => (
              <Link key={p.id} href={`/pitches/${p.id}`}>
                <Card className="transition-shadow hover:shadow-md">
                  <CardContent className="flex items-start gap-4 p-4">
                    <VoteButtons pitchId={p.id} upvotes={p.upvotes} downvotes={p.downvotes} myVote={p.my_vote} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{p.title}</p>
                        <Badge variant="secondary" className="text-[10px]">{STATUS_LABELS[p.status] ?? p.status}</Badge>
                      </div>
                      <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{p.description}</p>
                      <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                        {p.author && (
                          <span className="flex items-center gap-1">
                            <UserAvatar name={p.author.full_name} url={p.author.avatar_url} className="h-4 w-4" />
                            {p.author.full_name}
                          </span>
                        )}
                        <span>· {formatDate(p.created_at)}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
          {data.meta.totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Sebelumnya</Button>
              <span className="text-sm text-muted-foreground">Halaman {page} dari {data.meta.totalPages}</span>
              <Button variant="outline" size="sm" disabled={page >= data.meta.totalPages} onClick={() => setPage(page + 1)}>Berikutnya</Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default function PitchesPage() {
  return (
    <Suspense fallback={<LoadingSkeleton rows={4} />}>
      <PitchesContent />
    </Suspense>
  )
}
