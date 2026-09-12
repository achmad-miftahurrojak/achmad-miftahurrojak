'use client'

import { Suspense, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Image as ImageIcon, Plus, Trash2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { LoadingSkeleton } from '@/components/ui/loading-skeleton'
import { AssetUploadForm } from '@/components/assets/asset-upload-form'
import { useAssets, useDeleteAsset } from '@/hooks/use-assets'
import { useUser } from '@/hooks/use-user'
import { formatDate } from '@/lib/utils'
import { ADMIN_OR_KETUA } from '@jurnalis-org/shared/constants'

function AssetsContent() {
  const searchParams = useSearchParams()
  const [page, setPage] = useState(Number(searchParams.get('page') ?? 1))
  const [uploadOpen, setUploadOpen] = useState(false)
  const { data, isLoading } = useAssets(page)
  const { data: user } = useUser()
  const deleteAsset = useDeleteAsset()

  function canDelete(uploaderId?: string) {
    if (!user) return false
    return uploaderId === user.id || (ADMIN_OR_KETUA as readonly string[]).includes(user.role)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Bank Aset</h1>
        <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" /> Upload Aset</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Upload Aset</DialogTitle></DialogHeader>
            <AssetUploadForm onDone={() => setUploadOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <LoadingSkeleton rows={3} />
      ) : !data || data.data.length === 0 ? (
        <EmptyState icon={ImageIcon} title="Belum ada aset" description="Upload foto/desain untuk dipakai tim." />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {data.data.map((asset) => (
              <Card key={asset.id} className="overflow-hidden">
                <a href={asset.watermarked_url ?? asset.original_url} target="_blank" rel="noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={asset.watermarked_url ?? asset.original_url} alt={asset.title}
                    className="h-36 w-full object-cover" />
                </a>
                <CardContent className="p-3">
                  <p className="truncate text-sm font-medium">{asset.title}</p>
                  <div className="mt-1 flex items-center justify-between">
                    <div className="flex gap-1">
                      {asset.category && <Badge variant="secondary" className="text-[10px]">{asset.category}</Badge>}
                      {asset.watermark_status === 'done' && (
                        <Badge variant="outline" className="text-[10px]">WM</Badge>
                      )}
                    </div>
                    {canDelete(asset.uploader?.id) && (
                      <Button variant="ghost" size="icon" className="h-7 w-7"
                        onClick={() => deleteAsset.mutate(asset.id)}>
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    )}
                  </div>
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    {asset.uploader?.full_name ?? '-'} · {formatDate(asset.created_at)}
                  </p>
                </CardContent>
              </Card>
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

export default function AssetsPage() {
  return (
    <Suspense fallback={<LoadingSkeleton rows={3} />}>
      <AssetsContent />
    </Suspense>
  )
}
