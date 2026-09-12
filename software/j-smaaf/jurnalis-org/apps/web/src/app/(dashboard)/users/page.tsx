'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { toast } from 'sonner'
import { Users, Search } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { LoadingSkeleton } from '@/components/ui/loading-skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import { UserAvatar } from '@/components/ui/user-avatar'
import { apiJson } from '@/lib/api-client'
import { useUser } from '@/hooks/use-user'
import { ADMIN_OR_KETUA, ROLE_LABELS, ROLES } from '@jurnalis-org/shared/constants'

interface AdminUser {
  id: string
  full_name: string
  nickname: string | null
  email: string
  role: string
  division: string | null
  angkatan: number | null
  is_active: boolean
  avatar_url: string | null
  created_at: string
}

export default function UsersPage() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { data: user, isLoading: loadingUser } = useUser()
  const [q, setQ] = useState('')
  const canAccess = user ? (ADMIN_OR_KETUA as readonly string[]).includes(user.role) : false

  useEffect(() => {
    if (!loadingUser && user && !canAccess) router.replace('/dashboard')
  }, [user, loadingUser, canAccess, router])

  const { data, isLoading } = useQuery({
    queryKey: ['admin-users', q],
    queryFn: () => apiJson<{ data: AdminUser[] }>(`/api/users${q ? `?q=${encodeURIComponent(q)}` : ''}`),
    enabled: canAccess,
  })

  const updateUser = useMutation({
    mutationFn: ({ id, ...patch }: { id: string; role?: string; is_active?: boolean }) =>
      apiJson(`/api/users/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
    onSuccess: () => {
      toast.success('User diperbarui')
      void queryClient.invalidateQueries({ queryKey: ['admin-users'] })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  if (loadingUser || !canAccess) return <LoadingSkeleton rows={4} />

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Kelola Pengguna</h1>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input className="pl-9" placeholder="Cari nama atau email..." value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      {isLoading ? (
        <LoadingSkeleton rows={4} />
      ) : !data || data.data.length === 0 ? (
        <EmptyState icon={Users} title="Tidak ada user ditemukan" />
      ) : (
        <div className="space-y-2">
          {data.data.map((u) => (
            <Card key={u.id}>
              <CardContent className="flex flex-wrap items-center gap-3 p-4">
                <UserAvatar name={u.full_name} url={u.avatar_url} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{u.full_name}</p>
                  <p className="truncate text-xs text-muted-foreground">{u.email}</p>
                  {u.division && <p className="text-xs text-muted-foreground">{u.division}</p>}
                </div>
                <Select value={u.role} onValueChange={(role) => updateUser.mutate({ id: u.id, role })}
                  disabled={u.id === user?.id}>
                  <SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ROLES.map((r) => (
                      <SelectItem key={r} value={r}>{ROLE_LABELS[r] ?? r}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex items-center gap-2">
                  <Switch checked={u.is_active} onCheckedChange={(is_active) => updateUser.mutate({ id: u.id, is_active })}
                    disabled={u.id === user?.id} />
                  <Badge variant={u.is_active ? 'default' : 'destructive'} className="text-[10px]">
                    {u.is_active ? 'Aktif' : 'Nonaktif'}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
