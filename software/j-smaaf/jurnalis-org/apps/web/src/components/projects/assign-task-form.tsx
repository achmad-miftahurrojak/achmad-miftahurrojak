'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { taskCreateSchema, type TaskCreateInput } from '@jurnalis-org/shared/validations/tasks'
import { TASK_TYPE_LABELS, TASK_WEIGHTS } from '@jurnalis-org/shared/constants'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { useCreateTask, useMembers } from '@/hooks/use-tasks'

export function AssignTaskForm({
  projectId, open, onOpenChange,
}: {
  projectId?: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const createTask = useCreateTask()
  const { data: members } = useMembers()
  const form = useForm<TaskCreateInput>({
    resolver: zodResolver(taskCreateSchema),
    defaultValues: {
      title: '',
      description: '',
      type: 'lainnya',
      estimated_hours: 0,
    },
  })

  function onSubmit(input: TaskCreateInput) {
    createTask.mutate(
      {
        ...input,
        project_id: projectId ?? null,
        description: input.description || null,
        due_date: input.due_date ? new Date(input.due_date).toISOString() : null,
        weight: input.weight ?? TASK_WEIGHTS[input.type] ?? 5,
      },
      {
        onSuccess: () => {
          onOpenChange(false)
          form.reset()
        },
      },
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Tugas Baru</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField control={form.control} name="title" render={({ field }) => (
              <FormItem>
                <FormLabel>Judul</FormLabel>
                <FormControl><Input placeholder="Judul tugas" {...field} /></FormControl>
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
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="type" render={({ field }) => (
                <FormItem>
                  <FormLabel>Jenis</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      {Object.entries(TASK_TYPE_LABELS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>{label} (bobot {TASK_WEIGHTS[value]})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="assigned_to" render={({ field }) => (
                <FormItem>
                  <FormLabel>Tugaskan ke</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value ?? undefined}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Pilih anggota" /></SelectTrigger></FormControl>
                    <SelectContent>
                      {members?.data.map((m) => (
                        <SelectItem key={m.id} value={m.id}>{m.full_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
            <FormField control={form.control} name="due_date" render={({ field }) => (
              <FormItem>
                <FormLabel>Deadline</FormLabel>
                <FormControl><Input type="datetime-local" {...field} value={field.value ?? ''} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <Button type="submit" className="w-full" disabled={createTask.isPending}>
              {createTask.isPending ? 'Menyimpan...' : 'Buat Tugas'}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
