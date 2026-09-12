'use client'

import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { alumniProfileSchema, type AlumniProfileInput } from '@jurnalis-org/shared/validations/notifications'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { LoadingSkeleton } from '@/components/ui/loading-skeleton'
import { useMyAlumniProfile, useUpdateAlumniProfile } from '@/hooks/use-alumni'

export default function AlumniProfilePage() {
  const { data, isLoading } = useMyAlumniProfile()
  const updateProfile = useUpdateAlumniProfile()
  const form = useForm<AlumniProfileInput>({
    resolver: zodResolver(alumniProfileSchema),
    defaultValues: {
      graduation_year: undefined,
      current_job: '',
      company: '',
      linkedin_url: '',
      is_mentor: false,
      mentor_fields: [],
    },
  })

  useEffect(() => {
    if (data?.profile) {
      form.reset({
        graduation_year: data.profile.graduation_year ?? undefined,
        current_job: data.profile.current_job ?? '',
        company: data.profile.company ?? '',
        linkedin_url: data.profile.linkedin_url ?? '',
        is_mentor: data.profile.is_mentor,
        mentor_fields: data.profile.mentor_fields,
      })
    }
  }, [data, form])

  function onSubmit(input: AlumniProfileInput) {
    updateProfile.mutate({
      ...input,
      current_job: input.current_job || null,
      company: input.company || null,
      linkedin_url: input.linkedin_url || null,
    })
  }

  if (isLoading) return <LoadingSkeleton rows={3} />

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Profil Alumni</h1>
        <p className="text-sm text-muted-foreground">Lengkapi profilmu agar tetap terhubung dengan adik-adik kelas</p>
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">Data Alumni</CardTitle></CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField control={form.control} name="graduation_year" render={({ field }) => (
                <FormItem>
                  <FormLabel>Tahun Lulus</FormLabel>
                  <FormControl>
                    <Input type="number" {...field} value={field.value ?? ''}
                      onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="current_job" render={({ field }) => (
                <FormItem>
                  <FormLabel>Pekerjaan/Kuliah Saat Ini</FormLabel>
                  <FormControl><Input placeholder="Mis. Mahasiswa UI / Jurnalis Media X" {...field} value={field.value ?? ''} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="company" render={({ field }) => (
                <FormItem>
                  <FormLabel>Kampus/Perusahaan</FormLabel>
                  <FormControl><Input {...field} value={field.value ?? ''} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="linkedin_url" render={({ field }) => (
                <FormItem>
                  <FormLabel>LinkedIn URL (opsional)</FormLabel>
                  <FormControl><Input placeholder="https://linkedin.com/in/..." {...field} value={field.value ?? ''} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="is_mentor" render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-3">
                  <FormLabel className="text-sm font-normal">Bersedia jadi mentor anggota aktif</FormLabel>
                  <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                </FormItem>
              )} />
              <Button type="submit" className="w-full" disabled={updateProfile.isPending}>
                {updateProfile.isPending ? 'Menyimpan...' : 'Simpan Profil'}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  )
}
