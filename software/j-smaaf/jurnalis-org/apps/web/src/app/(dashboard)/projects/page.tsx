'use client'

import { Suspense, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { FolderKanban, Plus } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { EmptyState } from '@/components/ui/empty-state'
import { LoadingSkeleton } from '@/components/ui/loading-skeleton'
import { useProjects } from '@/hooks/use-projects'
import { useUser } from '@/hooks/use-user'
import { formatDate } from '@/lib/utils'
import { PENGURUS_OR_ABOVE } from '@jurnalis-org/shared/constants'

function ProjectsContent() {
  const searchParams = useSearchParams()
  const [page, setPage] = useState(Number(searchParams.get('page') ?? 1))
  const { data: user } = useUser()
  const { data, isLoading } = useProjects(page)
  const canManage = user ? (PENGURUS_OR_ABOVE as readonly string[]).includes(user.role) : false

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Proyek Liputan</h1>
          <p className="text-sm text-muted-foreground">{data?.meta.total ?? 0} proyek aktif</p>
        </div>
        {canManage && (
          <Button asChild>
            <Link href="/projects/new"><Plus className="mr-2 h-4 w-4" /> Proyek Baru</Link>
          </Button>
        )}
      </div>

      {isLoading ? (
        <LoadingSkeleton rows={4} />
      ) : !data || data.data.length === 0 ? (
        <EmptyState icon={FolderKanban} title="Belum ada proyek" description="Buat proyek liputan baru untuk mengelompokkan tugas tim." />
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {data.data.map((p) => (
              <Link key={p.id} href={`/projects/${p.id}`}>
                <Card className="h-full transition-shadow hover:shadow-md">
                  <CardHeader className="pb-2">
                    <CardTitle className="line-clamp-2 text-base">{p.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {p.description && <p className="line-clamp-2 text-sm text-muted-foreground">{p.description}</p>}
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>{p.task_count} tugas</span>
                        <span>{p.progress}%</span>
                      </div>
                      <Progress value={p.progress} />
                    </div>
                    {p.end_date && <p className="text-xs text-muted-foreground">Deadline: {formatDate(p.end_date)}</p>}
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

export default function ProjectsPage() {
  return (
    <Suspense fallback={<LoadingSkeleton rows={4} />}>
      <ProjectsContent />
    </Suspense>
  )
}
