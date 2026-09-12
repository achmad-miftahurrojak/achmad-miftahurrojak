'use client'

import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { projectFormSchema, type ProjectFormInput } from '@jurnalis-org/shared/validations/projects'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { useCreateProject } from '@/hooks/use-projects'

export function ProjectForm() {
  const router = useRouter()
  const createProject = useCreateProject()
  const form = useForm<ProjectFormInput>({
    resolver: zodResolver(projectFormSchema),
    defaultValues: {
      title: '',
      description: '',
      category: '',
      status: 'planning',
      start_date: '',
      end_date: '',
      estimated_hours: 0,
    },
  })

  function onSubmit(input: ProjectFormInput) {
    createProject.mutate(
      {
        ...input,
        description: input.description || null,
        category: input.category || null,
        start_date: input.start_date || null,
        end_date: input.end_date || null,
      },
      { onSuccess: () => router.push('/projects') },
    )
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField control={form.control} name="title" render={({ field }) => (
          <FormItem>
            <FormLabel>Judul Proyek</FormLabel>
            <FormControl><Input placeholder="Mis. Liputan Pensi 2026" {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />
        <FormField control={form.control} name="description" render={({ field }) => (
          <FormItem>
            <FormLabel>Deskripsi</FormLabel>
            <FormControl><Textarea rows={3} placeholder="Deskripsi singkat proyek..." {...field} value={field.value ?? ''} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />
        <div className="grid grid-cols-2 gap-4">
          <FormField control={form.control} name="start_date" render={({ field }) => (
            <FormItem>
              <FormLabel>Mulai</FormLabel>
              <FormControl><Input type="date" {...field} value={field.value ?? ''} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="end_date" render={({ field }) => (
            <FormItem>
              <FormLabel>Deadline</FormLabel>
              <FormControl><Input type="date" {...field} value={field.value ?? ''} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
        </div>
        <FormField control={form.control} name="status" render={({ field }) => (
          <FormItem>
            <FormLabel>Status</FormLabel>
            <Select onValueChange={field.onChange} defaultValue={field.value}>
              <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
              <SelectContent>
                <SelectItem value="planning">Perencanaan</SelectItem>
                <SelectItem value="active">Aktif</SelectItem>
                <SelectItem value="on_hold">Ditunda</SelectItem>
                <SelectItem value="completed">Selesai</SelectItem>
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )} />
        <Button type="submit" className="w-full" disabled={createProject.isPending}>
          {createProject.isPending ? 'Menyimpan...' : 'Buat Proyek'}
        </Button>
      </form>
    </Form>
  )
}
