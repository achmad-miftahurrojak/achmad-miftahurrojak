'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { BookOpen, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { LoadingSkeleton } from '@/components/ui/loading-skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import { apiJson, apiFetch } from '@/lib/api-client'
import { useUser } from '@/hooks/use-user'
import { ADMIN_OR_KETUA } from '@jurnalis-org/shared/constants'

interface KnowledgeDoc {
  id: string
  title: string
  content: string
  category: string | null
  is_public: boolean
  order_index: number
}

export default function SopManagePage() {
  const { data: user } = useUser()
  const canManage = user ? (ADMIN_OR_KETUA as readonly string[]).includes(user.role) : false
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [isPublic, setIsPublic] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['knowledge'],
    queryFn: () => apiJson<{ data: KnowledgeDoc[] }>('/api/knowledge'),
  })

  const createDoc = useMutation({
    mutationFn: () =>
      apiJson('/api/knowledge', {
        method: 'POST',
        body: JSON.stringify({ title, content, is_public: isPublic }),
      }),
    onSuccess: () => {
      toast.success('Dokumen ditambahkan')
      setOpen(false)
      setTitle('')
      setContent('')
      setIsPublic(false)
      void queryClient.invalidateQueries({ queryKey: ['knowledge'] })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const deleteDoc = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/knowledge/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('Dokumen dihapus')
      void queryClient.invalidateQueries({ queryKey: ['knowledge'] })
    },
    onError: () => toast.error('Gagal menghapus'),
  })

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">SOP & Knowledge Base</h1>
        {canManage && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="mr-2 h-4 w-4" /> Dokumen Baru</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Dokumen Baru</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Judul</Label>
                  <Input value={title} onChange={(e) => setTitle(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Isi</Label>
                  <Textarea rows={8} value={content} onChange={(e) => setContent(e.target.value)} />
                </div>
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <Label className="text-sm font-normal">Publikasikan ke halaman SOP publik</Label>
                  <Switch checked={isPublic} onCheckedChange={setIsPublic} />
                </div>
                <Button className="w-full" disabled={createDoc.isPending || title.length < 3 || content.length < 10}
                  onClick={() => createDoc.mutate()}>
                  Simpan
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {isLoading ? (
        <LoadingSkeleton rows={3} />
      ) : !data || data.data.length === 0 ? (
        <EmptyState icon={BookOpen} title="Belum ada dokumen" description="SOP dan panduan kerja akan muncul di sini." />
      ) : (
        <Card>
          <CardContent className="pt-4">
            <Accordion type="single" collapsible>
              {data.data.map((doc) => (
                <AccordionItem key={doc.id} value={doc.id}>
                  <AccordionTrigger>
                    <span className="flex items-center gap-2">
                      {doc.title}
                      {doc.is_public && <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary">publik</span>}
                    </span>
                  </AccordionTrigger>
                  <AccordionContent>
                    <p className="whitespace-pre-wrap text-sm text-muted-foreground">{doc.content}</p>
                    {canManage && (
                      <Button variant="ghost" size="sm" className="mt-2 text-destructive"
                        onClick={() => deleteDoc.mutate(doc.id)}>
                        <Trash2 className="mr-1 h-3 w-3" /> Hapus
                      </Button>
                    )}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
