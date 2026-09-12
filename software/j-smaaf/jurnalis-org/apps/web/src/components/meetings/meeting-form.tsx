'use client'

import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { meetingFormSchema, type MeetingFormInput } from '@jurnalis-org/shared/validations/meetings'
import { MEETING_TYPE_LABELS } from '@jurnalis-org/shared/constants'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { useCreateMeeting } from '@/hooks/use-meetings'

export function MeetingForm() {
  const router = useRouter()
  const createMeeting = useCreateMeeting()
  const form = useForm<MeetingFormInput>({
    resolver: zodResolver(meetingFormSchema),
    defaultValues: {
      title: '',
      type: 'rutin',
      description: '',
      start_time: '',
      end_time: '',
      location: '',
      link: '',
      is_mandatory: true,
    },
  })

  function onSubmit(input: MeetingFormInput) {
    createMeeting.mutate(
      {
        ...input,
        start_time: new Date(input.start_time).toISOString(),
        end_time: input.end_time ? new Date(input.end_time).toISOString() : null,
        description: input.description || null,
        location: input.location || null,
        link: input.link || null,
      },
      { onSuccess: () => router.push('/schedule') },
    )
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField control={form.control} name="title" render={({ field }) => (
          <FormItem>
            <FormLabel>Judul Kegiatan</FormLabel>
            <FormControl><Input placeholder="Mis. Rapat redaksi mingguan" {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />
        <FormField control={form.control} name="type" render={({ field }) => (
          <FormItem>
            <FormLabel>Jenis</FormLabel>
            <Select onValueChange={field.onChange} defaultValue={field.value}>
              <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
              <SelectContent>
                {Object.entries(MEETING_TYPE_LABELS).map(([v, l]) => (
                  <SelectItem key={v} value={v}>{l}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )} />
        <div className="grid grid-cols-2 gap-4">
          <FormField control={form.control} name="start_time" render={({ field }) => (
            <FormItem>
              <FormLabel>Mulai</FormLabel>
              <FormControl><Input type="datetime-local" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="end_time" render={({ field }) => (
            <FormItem>
              <FormLabel>Selesai (opsional)</FormLabel>
              <FormControl><Input type="datetime-local" {...field} value={field.value ?? ''} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
        </div>
        <FormField control={form.control} name="location" render={({ field }) => (
          <FormItem>
            <FormLabel>Lokasi</FormLabel>
            <FormControl><Input placeholder="Mis. Ruang UKM" {...field} value={field.value ?? ''} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />
        <FormField control={form.control} name="link" render={({ field }) => (
          <FormItem>
            <FormLabel>Link Meeting (opsional)</FormLabel>
            <FormControl><Input placeholder="https://meet.google.com/..." {...field} value={field.value ?? ''} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />
        <FormField control={form.control} name="description" render={({ field }) => (
          <FormItem>
            <FormLabel>Deskripsi</FormLabel>
            <FormControl><Textarea rows={2} {...field} value={field.value ?? ''} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />
        <FormField control={form.control} name="is_mandatory" render={({ field }) => (
          <FormItem className="flex items-center justify-between rounded-lg border p-3">
            <FormLabel className="text-sm font-normal">Wajib hadir untuk semua anggota</FormLabel>
            <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
          </FormItem>
        )} />
        <Button type="submit" className="w-full" disabled={createMeeting.isPending}>
          {createMeeting.isPending ? 'Menyimpan...' : 'Buat Kegiatan'}
        </Button>
      </form>
    </Form>
  )
}
