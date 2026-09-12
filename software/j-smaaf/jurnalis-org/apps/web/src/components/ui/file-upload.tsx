'use client'

import { useRef, useState } from 'react'
import { Upload, X, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { apiJson } from '@/lib/api-client'
import { compressImages } from './image-compressor'
import { toast } from 'sonner'

interface SignedUrlResponse {
  signedUrl: string
  path: string
  url: string
}

export interface UploadedFile {
  url: string
  name: string
}

export function FileUpload({
  bucket,
  folder,
  onChange,
  multiple = false,
  accept = 'image/*',
}: {
  bucket: 'public' | 'private'
  folder: string
  onChange: (files: UploadedFile[]) => void
  multiple?: boolean
  accept?: string
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [files, setFiles] = useState<UploadedFile[]>([])

  async function handleSelect(selected: FileList | null) {
    if (!selected || selected.length === 0) return
    setUploading(true)
    try {
      const compressed = await compressImages(Array.from(selected))
      const uploaded: UploadedFile[] = []
      for (const file of compressed) {
        const { signedUrl, url } = await apiJson<SignedUrlResponse>('/api/storage/signed-url', {
          method: 'POST',
          body: JSON.stringify({ filename: file.name, contentType: file.type, bucket, folder }),
        })
        const res = await fetch(signedUrl, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } })
        if (!res.ok) throw new Error(`Upload ${file.name} gagal`)
        uploaded.push({ url, name: file.name })
      }
      const next = multiple ? [...files, ...uploaded] : uploaded
      setFiles(next)
      onChange(next)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload gagal')
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  function remove(index: number) {
    const next = files.filter((_, i) => i !== index)
    setFiles(next)
    onChange(next)
  }

  return (
    <div className="space-y-2">
      <input ref={inputRef} type="file" accept={accept} multiple={multiple} className="hidden"
        onChange={(e) => void handleSelect(e.target.files)} />
      <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => inputRef.current?.click()}>
        <Upload className="mr-2 h-4 w-4" />
        {uploading ? 'Mengupload...' : 'Pilih File'}
      </Button>
      {files.map((f, i) => (
        <div key={i} className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
          <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="flex-1 truncate">{f.name}</span>
          <button type="button" onClick={() => remove(i)} className="text-muted-foreground hover:text-destructive">
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  )
}
