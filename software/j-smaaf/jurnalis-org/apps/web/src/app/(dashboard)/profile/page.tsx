'use client'

import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { updateProfileSchema, type UpdateProfileInput } from '@jurnalis-org/shared/validations/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Label } from '@/components/ui/label'
import { FileUpload, type UploadedFile } from '@/components/ui/file-upload'
import { UserAvatar } from '@/components/ui/user-avatar'
import { LoadingSkeleton } from '@/components/ui/loading-skeleton'
import { apiJson } from '@/lib/api-client'
import { useUser } from '@/hooks/use-user'
import { useQueryClient } from '@tanstack/react-query'
import { ROLE_LABELS } from '@jurnalis-org/shared/constants'

export default function ProfilePage() {
  const { data: user, isLoading } = useUser()
  const queryClient = useQueryClient()
  const [avatar, setAvatar] = useState<UploadedFile[]>([])
  const [saving, setSaving] = useState(false)
  const form = useForm<UpdateProfileInput>({
    resolver: zodResolver(updateProfileSchema),
    defaultValues: { full_name: '', nickname: '', phone: '', division: '', bio: '' },
  })

  useEffect(() => {
    if (user) {
      form.reset({
        full_name: user.full_name,
        nickname: user.nickname ?? '',
        phone: user.phone ?? '',
        division: user.division ?? '',
        bio: user.bio ?? '',
      })
    }
  }, [user, form])

  async function onSubmit(input: UpdateProfileInput) {
    setSaving(true)
    try {
      await apiJson('/api/auth/me', {
        method: 'PATCH',
        body: JSON.stringify({
          ...input,
          phone: input.phone || null,
          nickname: input.nickname || null,
          division: input.division || null,
          bio: input.bio || null,
          avatar_url: avatar[0]?.url,
        }),
      })
      toast.success('Profil diperbarui')
      void queryClient.invalidateQueries({ queryKey: ['me'] })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal menyimpan')
    } finally {
      setSaving(false)
    }
  }

  if (isLoading || !user) return <LoadingSkeleton rows={3} />

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Profil Saya</h1>
        <p className="text-sm text-muted-foreground">{ROLE_LABELS[user.role] ?? user.role} · {user.email}</p>
      </div>
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <UserAvatar name={user.full_name} url={avatar[0]?.url ?? user.avatar_url} className="h-14 w-14" />
            <CardTitle className="text-base">{user.full_name}</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label>Foto Profil</Label>
                <FileUpload bucket="public" folder="avatars" onChange={setAvatar} />
              </div>
              <FormField control={form.control} name="full_name" render={({ field }) => (
                <FormItem><FormLabel>Nama Lengkap</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="nickname" render={({ field }) => (
                <FormItem><FormLabel>Nama Panggilan</FormLabel><FormControl><Input {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="phone" render={({ field }) => (
                <FormItem><FormLabel>No. WhatsApp</FormLabel><FormControl><Input {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="division" render={({ field }) => (
                <FormItem><FormLabel>Divisi</FormLabel><FormControl><Input {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="bio" render={({ field }) => (
                <FormItem><FormLabel>Bio</FormLabel><FormControl><Textarea rows={3} {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
              )} />
              <Button type="submit" className="w-full" disabled={saving}>
                {saving ? 'Menyimpan...' : 'Simpan Perubahan'}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  )
}
