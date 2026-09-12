'use client'

import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { pitchFormSchema, type PitchFormInput } from '@jurnalis-org/shared/validations/pitches'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { useCreatePitch } from '@/hooks/use-pitches'

export function PitchForm() {
  const router = useRouter()
  const createPitch = useCreatePitch()
  const form = useForm<PitchFormInput>({
    resolver: zodResolver(pitchFormSchema),
    defaultValues: { title: '', description: '', category: '', estimated_effort: '', expected_impact: '' },
  })

  function onSubmit(input: PitchFormInput) {
    createPitch.mutate(
      {
        ...input,
        category: input.category || null,
        estimated_effort: input.estimated_effort || null,
        expected_impact: input.expected_impact || null,
      },
      { onSuccess: () => router.push('/pitches') },
    )
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField control={form.control} name="title" render={({ field }) => (
          <FormItem>
            <FormLabel>Judul Ide</FormLabel>
            <FormControl><Input placeholder="Mis. Podcast mingguan OSIS" {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />
        <FormField control={form.control} name="description" render={({ field }) => (
          <FormItem>
            <FormLabel>Deskripsi</FormLabel>
            <FormControl><Textarea rows={5} placeholder="Jelaskan ide konten/proyek ini secara detail..." {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />
        <FormField control={form.control} name="estimated_effort" render={({ field }) => (
          <FormItem>
            <FormLabel>Estimasi Effort (opsional)</FormLabel>
            <FormControl><Input placeholder="Mis. 2 minggu, 3 orang" {...field} value={field.value ?? ''} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />
        <FormField control={form.control} name="expected_impact" render={({ field }) => (
          <FormItem>
            <FormLabel>Dampak yang Diharapkan (opsional)</FormLabel>
            <FormControl><Input placeholder="Mis. Meningkatkan engagement Instagram" {...field} value={field.value ?? ''} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />
        <Button type="submit" className="w-full" disabled={createPitch.isPending}>
          {createPitch.isPending ? 'Mengirim...' : 'Posting Ide'}
        </Button>
      </form>
    </Form>
  )
}
