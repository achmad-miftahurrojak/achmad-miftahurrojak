'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { financeTransactionSchema, type FinanceTransactionInput } from '@jurnalis-org/shared/validations/finance'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Label } from '@/components/ui/label'
import { FileUpload, type UploadedFile } from '@/components/ui/file-upload'
import { useCreateTransaction } from '@/hooks/use-finance'

export function FinanceForm({ onDone }: { onDone: () => void }) {
  const createTx = useCreateTransaction()
  const [proof, setProof] = useState<UploadedFile[]>([])
  const form = useForm<FinanceTransactionInput>({
    resolver: zodResolver(financeTransactionSchema),
    defaultValues: { type: 'pemasukan', amount: 0, description: '', category: '' },
  })

  function onSubmit(input: FinanceTransactionInput) {
    createTx.mutate(
      { ...input, category: input.category || null, proof_url: proof[0]?.url ?? null },
      {
        onSuccess: () => {
          form.reset()
          setProof([])
          onDone()
        },
      },
    )
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField control={form.control} name="type" render={({ field }) => (
          <FormItem>
            <FormLabel>Jenis Transaksi</FormLabel>
            <Select onValueChange={field.onChange} defaultValue={field.value}>
              <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
              <SelectContent>
                <SelectItem value="pemasukan">Pemasukan</SelectItem>
                <SelectItem value="pengeluaran">Pengeluaran</SelectItem>
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )} />
        <FormField control={form.control} name="amount" render={({ field }) => (
          <FormItem>
            <FormLabel>Jumlah (Rp)</FormLabel>
            <FormControl>
              <Input type="number" min={1} {...field} onChange={(e) => field.onChange(Number(e.target.value))} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )} />
        <FormField control={form.control} name="description" render={({ field }) => (
          <FormItem>
            <FormLabel>Deskripsi</FormLabel>
            <FormControl><Input placeholder="Mis. Kas bulanan September" {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />
        <FormField control={form.control} name="category" render={({ field }) => (
          <FormItem>
            <FormLabel>Kategori (opsional)</FormLabel>
            <FormControl><Input placeholder="Mis. Kas, Konsumsi, ATK" {...field} value={field.value ?? ''} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />
        <div className="space-y-2">
          <Label>Bukti (opsional)</Label>
          <FileUpload bucket="private" folder="finance" onChange={setProof} />
        </div>
        <Button type="submit" className="w-full" disabled={createTx.isPending}>
          {createTx.isPending ? 'Menyimpan...' : 'Catat Transaksi'}
        </Button>
      </form>
    </Form>
  )
}
