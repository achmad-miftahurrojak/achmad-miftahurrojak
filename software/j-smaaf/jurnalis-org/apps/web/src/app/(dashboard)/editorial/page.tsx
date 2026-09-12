'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { LoadingSkeleton } from '@/components/ui/loading-skeleton'
import { EditorialBoard } from '@/components/content/editorial-board'
import { useContentList } from '@/hooks/use-content'
import { useUser } from '@/hooks/use-user'
import { EDITORIAL_ACCESS } from '@jurnalis-org/shared/constants'

export default function EditorialPage() {
  const router = useRouter()
  const { data: user, isLoading: loadingUser } = useUser()
  const { data, isLoading } = useContentList(1)
  const canAccess = user ? (EDITORIAL_ACCESS as readonly string[]).includes(user.role) : false

  useEffect(() => {
    if (!loadingUser && user && !canAccess) {
      router.replace('/dashboard')
    }
  }, [user, loadingUser, canAccess, router])

  if (isLoading || loadingUser || !canAccess) return <LoadingSkeleton rows={4} />

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Pipeline Editorial</h1>
        <p className="text-sm text-muted-foreground">Drag kartu untuk memindahkan status konten</p>
      </div>
      <EditorialBoard items={data?.data ?? []} />
    </div>
  )
}
