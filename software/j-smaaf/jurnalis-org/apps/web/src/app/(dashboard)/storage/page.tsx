'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { HardDrive, FolderOpen, Download, Trash2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { LoadingSkeleton } from '@/components/ui/loading-skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import { FileUpload, type UploadedFile } from '@/components/ui/file-upload'
import { apiJson, apiFetch } from '@/lib/api-client'
import { useUser } from '@/hooks/use-user'
import { formatDateTime } from '@/lib/utils'
import { toast } from 'sonner'
import { PENGURUS_OR_ABOVE } from '@jurnalis-org/shared/constants'

interface StoredFile {
  path: string
  size: number
  lastModified: string | null
}

export default function StoragePage() {
  const [bucket, setBucket] = useState<'public' | 'private'>('public')
  const { data: user } = useUser()
  const canDelete = user ? (PENGURUS_OR_ABOVE as readonly string[]).includes(user.role) : false

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['storage-files', bucket],
    queryFn: () => apiJson<{ files: StoredFile[] }>(`/api/storage/files?bucket=${bucket}`),
  })

  function handleUploaded(_files: UploadedFile[]) {
    void refetch()
    toast.success('File terupload')
  }

  async function handleDownload(path: string) {
    const res = await apiJson<{ signedUrl: string }>('/api/storage/download-url', {
      method: 'POST',
      body: JSON.stringify({ bucket, path }),
    })
    window.open(res.signedUrl, '_blank')
  }

  async function handleDelete(path: string) {
    const res = await apiFetch('/api/storage/files', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bucket, path }),
    })
    if (res.ok) {
      toast.success('File dihapus')
      void refetch()
    } else {
      toast.error('Gagal menghapus file')
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Storage</h1>

      <Tabs value={bucket} onValueChange={(v) => setBucket(v as 'public' | 'private')}>
        <TabsList>
          <TabsTrigger value="public">Public</TabsTrigger>
          <TabsTrigger value="private">Private</TabsTrigger>
        </TabsList>
      </Tabs>

      <Card>
        <CardContent className="p-4">
          <FileUpload bucket={bucket} folder="storage" multiple onChange={handleUploaded} />
        </CardContent>
      </Card>

      {isLoading ? (
        <LoadingSkeleton rows={3} />
      ) : !data || data.files.length === 0 ? (
        <EmptyState icon={HardDrive} title="Bucket kosong" description="File yang diupload akan muncul di sini." />
      ) : (
        <div className="space-y-2">
          {data.files.map((f) => (
            <Card key={f.path}>
              <CardContent className="flex items-center gap-3 p-3">
                <FolderOpen className="h-5 w-5 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{f.path}</p>
                  <p className="text-xs text-muted-foreground">
                    {(f.size / 1024).toFixed(1)} KB{f.lastModified ? ` · ${formatDateTime(f.lastModified)}` : ''}
                  </p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => void handleDownload(f.path)}>
                  <Download className="h-4 w-4" />
                </Button>
                {canDelete && (
                  <Button variant="ghost" size="icon" onClick={() => void handleDelete(f.path)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
