'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Bell } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { LoadingSkeleton } from '@/components/ui/loading-skeleton'
import { apiJson } from '@/lib/api-client'
import { useUser } from '@/hooks/use-user'

const NOTIF_TYPES = [
  { value: 'task_assigned', label: 'Tugas baru' },
  { value: 'task_status', label: 'Perubahan status tugas' },
  { value: 'meeting_reminder', label: 'Pengingat kegiatan' },
  { value: 'finance_pending', label: 'Approval keuangan' },
]

export default function SettingsPage() {
  const { data: user, isLoading } = useUser()
  const [emailNotif, setEmailNotif] = useState(true)
  const [waNotif, setWaNotif] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (user) {
      setEmailNotif(user.email_notifications)
      setWaNotif(user.wa_notifications)
    }
  }, [user])

  async function saveChannelPrefs() {
    setSaving(true)
    try {
      await apiJson('/api/auth/me', {
        method: 'PATCH',
        body: JSON.stringify({ email_notifications: emailNotif, wa_notifications: waNotif }),
      })
      for (const t of NOTIF_TYPES) {
        await apiJson('/api/notifications/preferences', {
          method: 'POST',
          body: JSON.stringify({ notif_type: t.value, in_app: true, whatsapp: waNotif, email: emailNotif }),
        })
      }
      toast.success('Pengaturan notifikasi disimpan')
    } catch {
      toast.error('Gagal menyimpan pengaturan')
    } finally {
      setSaving(false)
    }
  }

  if (isLoading || !user) return <LoadingSkeleton rows={2} />

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <h1 className="text-2xl font-bold">Pengaturan</h1>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Bell className="h-5 w-5" /> Notifikasi
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <Label className="text-sm font-medium">Notifikasi WhatsApp</Label>
              <p className="text-xs text-muted-foreground">Kirim notifikasi penting ke nomor WA kamu</p>
            </div>
            <Switch checked={waNotif} onCheckedChange={setWaNotif} />
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <Label className="text-sm font-medium">Notifikasi Email</Label>
              <p className="text-xs text-muted-foreground">Kirim notifikasi ke {user.email}</p>
            </div>
            <Switch checked={emailNotif} onCheckedChange={setEmailNotif} />
          </div>
          <Button className="w-full" onClick={() => void saveChannelPrefs()} disabled={saving}>
            {saving ? 'Menyimpan...' : 'Simpan Pengaturan'}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
