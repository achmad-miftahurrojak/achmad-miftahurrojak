import Link from 'next/link'
import { GraduationCap } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { UserAvatar } from '@/components/ui/user-avatar'

export const metadata = { title: 'Alumni' }

const BACKEND_URL = process.env.BACKEND_URL ?? 'http://localhost:4000'

interface AlumniItem {
  id: string
  full_name: string
  nickname: string | null
  avatar_url: string | null
  angkatan: number | null
  graduation_year: number | null
  current_job: string | null
  alumni_connection: { company: string | null; is_mentor: boolean } | null
}

async function getAlumni(page: number, angkatan?: string) {
  try {
    const params = new URLSearchParams({ page: String(page) })
    if (angkatan) params.set('angkatan', angkatan)
    const res = await fetch(`${BACKEND_URL}/api/alumni?${params}`, { next: { revalidate: 3600 } })
    if (!res.ok) return null
    return (await res.json()) as {
      data: AlumniItem[]
      meta: { total: number; page: number; totalPages: number }
      years: number[]
    }
  } catch {
    return null
  }
}

export default async function AlumniPage({ searchParams }: { searchParams: Promise<{ page?: string; angkatan?: string }> }) {
  const sp = await searchParams
  const page = Math.max(1, Number(sp.page ?? 1))
  const data = await getAlumni(page, sp.angkatan)

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="text-3xl font-bold">Alumni</h1>
      <p className="mt-2 text-muted-foreground">Jaringan alumni Jurnalis Org lintas angkatan.</p>

      {data && data.years.length > 0 && (
        <div className="mt-6 flex flex-wrap gap-2">
          <Button variant={!sp.angkatan ? 'default' : 'outline'} size="sm" asChild>
            <Link href="/alumni">Semua</Link>
          </Button>
          {data.years.map((y) => (
            <Button key={y} variant={sp.angkatan === String(y) ? 'default' : 'outline'} size="sm" asChild>
              <Link href={`/alumni?angkatan=${y}`}>{y}</Link>
            </Button>
          ))}
        </div>
      )}

      {!data || data.data.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-center">
          <GraduationCap className="mb-3 h-10 w-10 text-muted-foreground/50" />
          <p className="text-muted-foreground">Belum ada data alumni.</p>
        </div>
      ) : (
        <>
          <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {data.data.map((a) => (
              <Card key={a.id}>
                <CardContent className="flex items-center gap-3 p-4">
                  <UserAvatar name={a.full_name} url={a.avatar_url} className="h-10 w-10" />
                  <div className="min-w-0">
                    <p className="truncate font-medium">{a.nickname ?? a.full_name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {a.current_job ?? 'Alumni'}
                      {a.alumni_connection?.company ? ` · ${a.alumni_connection.company}` : ''}
                    </p>
                    <div className="mt-1 flex gap-1">
                      {a.angkatan && <Badge variant="secondary" className="text-[10px]">Angkatan {a.angkatan}</Badge>}
                      {a.alumni_connection?.is_mentor && (
                        <Badge variant="outline" className="text-[10px]">Mentor</Badge>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          {data.meta.totalPages > 1 && (
            <div className="mt-8 flex items-center justify-center gap-2">
              {page > 1 && (
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/alumni?page=${page - 1}${sp.angkatan ? `&angkatan=${sp.angkatan}` : ''}`}>Sebelumnya</Link>
                </Button>
              )}
              <span className="text-sm text-muted-foreground">Halaman {page} dari {data.meta.totalPages}</span>
              {page < data.meta.totalPages && (
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/alumni?page=${page + 1}${sp.angkatan ? `&angkatan=${sp.angkatan}` : ''}`}>Berikutnya</Link>
                </Button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
