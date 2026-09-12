'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { registerSchema, type RegisterInput } from '@jurnalis-org/shared/validations/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'

export default function RegisterPage() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const form = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: { full_name: '', nickname: '', email: '', password: '', phone: '', division: '' },
  })

  async function onSubmit(input: RegisterInput) {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...input, phone: input.phone || undefined, division: input.division || undefined }),
      })
      const body = (await res.json()) as { error?: string }
      if (!res.ok) {
        setError(body.error ?? 'Registrasi gagal')
        return
      }
      router.push('/dashboard')
      router.refresh()
    } catch {
      setError('Tidak bisa terhubung ke server')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-secondary/30 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl text-primary">Daftar Anggota</CardTitle>
          <CardDescription>Buat akun Jurnalis Org</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
              <FormField control={form.control} name="full_name" render={({ field }) => (
                <FormItem>
                  <FormLabel>Nama Lengkap</FormLabel>
                  <FormControl><Input placeholder="Nama lengkap" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="nickname" render={({ field }) => (
                <FormItem>
                  <FormLabel>Nama Panggilan (opsional)</FormLabel>
                  <FormControl><Input placeholder="Panggilan" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="email" render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl><Input type="email" placeholder="nama@email.com" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="password" render={({ field }) => (
                <FormItem>
                  <FormLabel>Password</FormLabel>
                  <FormControl><Input type="password" placeholder="Minimal 8 karakter" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="phone" render={({ field }) => (
                <FormItem>
                  <FormLabel>No. WhatsApp (opsional)</FormLabel>
                  <FormControl><Input placeholder="08xxxxxxxxxx" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="division" render={({ field }) => (
                <FormItem>
                  <FormLabel>Divisi (opsional)</FormLabel>
                  <FormControl><Input placeholder="Mis. Liputan" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Memproses...' : 'Daftar'}
              </Button>
            </form>
          </Form>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            Sudah punya akun?{' '}
            <Link href="/login" className="text-primary hover:underline">Masuk</Link>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
