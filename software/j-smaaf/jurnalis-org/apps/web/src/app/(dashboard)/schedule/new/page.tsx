'use client'

import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { MeetingForm } from '@/components/meetings/meeting-form'

export default function NewMeetingPage() {
  const router = useRouter()
  return (
    <div className="mx-auto max-w-xl space-y-6">
      <Button variant="ghost" size="sm" onClick={() => router.back()}>
        <ArrowLeft className="mr-2 h-4 w-4" /> Kembali
      </Button>
      <Card>
        <CardHeader>
          <CardTitle>Kegiatan Baru</CardTitle>
        </CardHeader>
        <CardContent>
          <MeetingForm />
        </CardContent>
      </Card>
    </div>
  )
}
