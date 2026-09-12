'use client'

import { Suspense, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Newspaper, Plus } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { StatusBadge } from '@/components/ui/status-badge'
import { EmptyState } from '@/components/ui/empty-state'
import { LoadingSkeleton } from '@/components/ui/loading-skeleton'
import { useContentList } from '@/hooks/use-content'
import { formatDateTime } from '@/lib/utils'
import { CONTENT_CATEGORY_LABELS } from '@jurnalis-org/shared/constants'

const TABS = [
  { value: 'all', label: 'Semua' },
  { value: 'draft', label: 'Draft' },
  { value: 'review', label: 'Review' },
  { value: 'published', label: 'Terbit' },
]

function ContentListContent() {
  const searchParams = useSearchParams()
  const [page, setPage] = useState(Number(searchParams.get('page') ?? 1))
  const [status, setStatus] = useState('all')
  const { data, isLoading } = useContentList(page, status === 'all' ? undefined : status)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Konten</h1>
        <Button asChild>
          <Link href="/content/new"><Plus className="mr-2 h-4 w-4" /> Tulis Baru</Link>
        </Button>
      </div>

      <Tabs value={status} onValueChange={(v) => { setStatus(v); setPage(1) }}>
        <TabsList>
          {TABS.map((t) => <TabsTrigger key={t.value} value={t.value}>{t.label}</TabsTrigger>)}
        </TabsList>
      </Tabs>

      {isLoading ? (
        <LoadingSkeleton rows={4} />
      ) : !data || data.data.length === 0 ? (
        <EmptyState icon={Newspaper} title="Belum ada konten" description="Mulai menulis artikel pertamamu." />
      ) : (
        <>
          <div className="space-y-2">
            {data.data.map((item) => (
              <Link key={item.id} href={`/content/${item.id}`}>
                <Card className="transition-shadow hover:shadow-md">
                  <CardContent className="flex items-center gap-4 p-4">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{item.title}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {CONTENT_CATEGORY_LABELS[item.category] ?? item.category}
                        {' · '}{item.author?.full_name ?? '-'}
                        {' · '}{formatDateTime(item.updated_at)}
                        {' · '}{item.views} views
                      </p>
                    </div>
                    <StatusBadge status={item.status} />
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

export default function ContentPage() {
  return (
    <Suspense fallback={<LoadingSkeleton rows={4} />}>
      <ContentListContent />
    </Suspense>
  )
}
