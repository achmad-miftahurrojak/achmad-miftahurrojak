'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { contentFormSchema, type ContentFormInput } from '@jurnalis-org/shared/validations/content'
import { CONTENT_CATEGORY_LABELS } from '@jurnalis-org/shared/constants'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Label } from '@/components/ui/label'
import { ContentEditor } from './content-editor'
import { useCreateContent, useUpdateContent, type ContentDetail } from '@/hooks/use-content'

export function ContentForm({ existing }: { existing?: ContentDetail }) {
  const router = useRouter()
  const createContent = useCreateContent()
  const updateContent = useUpdateContent(existing?.id ?? '')
  const [body, setBody] = useState(existing?.content ?? '')
  const isEdit = Boolean(existing)

  const form = useForm<ContentFormInput>({
    resolver: zodResolver(contentFormSchema),
    defaultValues: {
      title: existing?.title ?? '',
      excerpt: existing?.excerpt ?? '',
      content: existing?.content ?? '',
      category: (existing?.category as ContentFormInput['category']) ?? 'sma',
      cover_image: existing?.cover_image ?? '',
      tags: existing?.tags ?? [],
      youtube_id: existing?.youtube_id ?? '',
      is_featured: existing?.is_featured ?? false,
      seo_title: existing?.seo_title ?? '',
      seo_desc: existing?.seo_desc ?? '',
    },
  })

  function onSubmit(input: ContentFormInput) {
    const payload: ContentFormInput = {
      ...input,
      content: body,
      excerpt: input.excerpt || null,
      cover_image: input.cover_image || null,
      youtube_id: input.youtube_id || null,
      seo_title: input.seo_title || null,
      seo_desc: input.seo_desc || null,
    }
    if (isEdit) {
      updateContent.mutate(payload, { onSuccess: () => router.push('/content') })
    } else {
      createContent.mutate(payload, { onSuccess: () => router.push('/content') })
    }
  }

  const pending = createContent.isPending || updateContent.isPending

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField control={form.control} name="title" render={({ field }) => (
          <FormItem>
            <FormLabel>Judul</FormLabel>
            <FormControl><Input placeholder="Judul artikel" {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />
        <div className="grid grid-cols-2 gap-4">
          <FormField control={form.control} name="category" render={({ field }) => (
            <FormItem>
              <FormLabel>Kategori</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                <SelectContent>
                  {Object.entries(CONTENT_CATEGORY_LABELS).map(([v, l]) => (
                    <SelectItem key={v} value={v}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="cover_image" render={({ field }) => (
            <FormItem>
              <FormLabel>URL Cover (opsional)</FormLabel>
              <FormControl><Input placeholder="https://..." {...field} value={field.value ?? ''} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
        </div>
        <FormField control={form.control} name="excerpt" render={({ field }) => (
          <FormItem>
            <FormLabel>Ringkasan (opsional)</FormLabel>
            <FormControl><Textarea rows={2} placeholder="Ringkasan singkat untuk preview..." {...field} value={field.value ?? ''} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />
        <div className="space-y-2">
          <Label>Isi Artikel</Label>
          <ContentEditor content={body} onChange={setBody} />
        </div>
        <FormField control={form.control} name="youtube_id" render={({ field }) => (
          <FormItem>
            <FormLabel>YouTube Video ID (opsional)</FormLabel>
            <FormControl><Input placeholder="Mis. dQw4w9WgXcQ" {...field} value={field.value ?? ''} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />
        <FormField control={form.control} name="is_featured" render={({ field }) => (
          <FormItem className="flex items-center justify-between rounded-lg border p-3">
            <FormLabel className="text-sm font-normal">Tampilkan sebagai konten unggulan</FormLabel>
            <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
          </FormItem>
        )} />
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? 'Menyimpan...' : isEdit ? 'Simpan Perubahan' : 'Buat Konten'}
        </Button>
      </form>
    </Form>
  )
}
