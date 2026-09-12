'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { apiJson } from '@/lib/api-client'
import { applyWatermark } from '@/lib/watermark'
import { compressImages } from '@/components/ui/image-compressor'
import { useCreateAsset } from '@/hooks/use-assets'

interface SignedUrlResponse {
  signedUrl: string
  url: string
}

async function uploadFile(file: File, folder: string): Promise<string> {
  const { signedUrl, url } = await apiJson<SignedUrlResponse>('/api/storage/signed-url', {
    method: 'POST',
    body: JSON.stringify({ filename: file.name, contentType: file.type, bucket: 'public', folder }),
  })
  const res = await fetch(signedUrl, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } })
  if (!res.ok) throw new Error('Upload gagal')
  return url
}

export function AssetUploadForm({ onDone }: { onDone: () => void }) {
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState<string>('foto')
  const [file, setFile] = useState<File | null>(null)
  const [withWatermark, setWithWatermark] = useState(true)
  const [isPublic, setIsPublic] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const createAsset = useCreateAsset()

  async function handleFile(selected: File | null) {
    setFile(selected)
    if (preview) URL.revokeObjectURL(preview)
    setPreview(selected ? URL.createObjectURL(selected) : null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!file || title.length < 2) return
    setUploading(true)
    try {
      const [compressed] = await compressImages([file])
      const originalUrl = await uploadFile(compressed, 'assets')
      let watermarkedUrl: string | null = null
      if (withWatermark && file.type.startsWith('image/')) {
        const watermarked = await applyWatermark(compressed, 'Jurnalis Org')
        watermarkedUrl = await uploadFile(watermarked, 'assets/watermarked')
      }
      createAsset.mutate(
        {
          title,
          category: category as 'foto' | 'desain' | 'dokumentasi',
          original_url: originalUrl,
          watermarked_url: watermarkedUrl,
          tags: [],
          is_public: isPublic,
        },
        {
          onSuccess: () => {
            setTitle('')
            setFile(null)
            setPreview(null)
            onDone()
          },
        },
      )
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload gagal')
    } finally {
      setUploading(false)
    }
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
      <div className="space-y-2">
        <Label>Judul Aset</Label>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Mis. Dokumentasi Pensi" />
      </div>
      <div className="space-y-2">
        <Label>Kategori</Label>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="foto">Foto</SelectItem>
            <SelectItem value="desain">Desain</SelectItem>
            <SelectItem value="dokumentasi">Dokumentasi</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>File Gambar</Label>
        <Input type="file" accept="image/*" onChange={(e) => void handleFile(e.target.files?.[0] ?? null)} />
        {preview && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="Preview" className="mt-2 max-h-48 rounded-lg object-cover" />
        )}
      </div>
      <div className="flex items-center justify-between rounded-lg border p-3">
        <Label className="text-sm font-normal">Tambahkan watermark &quot;Jurnalis Org&quot;</Label>
        <Switch checked={withWatermark} onCheckedChange={setWithWatermark} />
      </div>
      <div className="flex items-center justify-between rounded-lg border p-3">
        <Label className="text-sm font-normal">Tampilkan di galeri publik</Label>
        <Switch checked={isPublic} onCheckedChange={setIsPublic} />
      </div>
      <Button type="submit" className="w-full" disabled={uploading || !file || title.length < 2}>
        {uploading ? 'Mengupload...' : 'Upload Aset'}
      </Button>
    </form>
  )
}
