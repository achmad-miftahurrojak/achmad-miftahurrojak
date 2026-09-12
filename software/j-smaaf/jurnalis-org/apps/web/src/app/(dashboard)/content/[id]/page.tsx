'use client'

import { use } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { StatusBadge } from '@/components/ui/status-badge'
import { LoadingSkeleton } from '@/components/ui/loading-skeleton'
import { ContentForm } from '@/components/content/content-form'
import { useContent, useUpdateContentStage } from '@/hooks/use-content'
import { useUser } from '@/hooks/use-user'
import { EDITORIAL_ACCESS } from '@jurnalis-org/shared/constants'

export default function ContentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const { data: item, isLoading } = useContent(id)
  const { data: user } = useUser()
  const updateStage = useUpdateContentStage()

  if (isLoading || !item) return <LoadingSkeleton rows={5} />

  const isEditor = user ? (EDITORIAL_ACCESS as readonly string[]).includes(user.role) : false
  const isAuthor = item.author_id === user?.id

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Kembali
        </Button>
        <div className="flex items-center gap-2">
          <StatusBadge status={item.status} />
          {item.status === 'published' && (
            <Button variant="outline" size="sm" asChild>
              <a href={`/news/${item.slug}`} target="_blank" rel="noreferrer">
                <ExternalLink className="mr-1 h-3 w-3" /> Lihat Publik
              </a>
            </Button>
          )}
        </div>
      </div>

      {isEditor && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Aksi Editorial</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {item.status === 'draft' && (
              <Button size="sm" variant="outline" onClick={() => updateStage.mutate({ id: item.id, status: 'review' })}>
                Ajukan Review
              </Button>
            )}
            {item.status === 'review' && (
              <>
                <Button size="sm" onClick={() => updateStage.mutate({ id: item.id, status: 'published' })}>
                  Publish
                </Button>
                <Button size="sm" variant="outline" onClick={() => updateStage.mutate({ id: item.id, status: 'revision' })}>
                  Minta Revisi
                </Button>
              </>
            )}
            {item.status === 'revision' && (
              <Button size="sm" variant="outline" onClick={() => updateStage.mutate({ id: item.id, status: 'review' })}>
                Kirim Ulang ke Review
              </Button>
            )}
            {item.status === 'published' && (
              <Button size="sm" variant="outline" onClick={() => updateStage.mutate({ id: item.id, status: 'archived' })}>
                Arsipkan
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{isEditor || isAuthor ? 'Edit Konten' : item.title}</CardTitle>
        </CardHeader>
        <CardContent>
          {isEditor || isAuthor ? (
            <ContentForm existing={item} />
          ) : (
            <div className="article-content" dangerouslySetInnerHTML={{ __html: item.content }} />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
