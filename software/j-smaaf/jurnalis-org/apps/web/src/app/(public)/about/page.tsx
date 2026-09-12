import { Trophy, Target, ListChecks } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { getPublicOrg } from '@/lib/server-api'

export const metadata = { title: 'Tentang Kami' }

export default async function AboutPage() {
  const data = await getPublicOrg()
  const org = data?.org

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-bold">{org?.name ?? 'Jurnalis Org'}</h1>
      {org?.tagline && <p className="mt-2 text-lg text-muted-foreground">{org.tagline}</p>}

      {org?.vision && (
        <Card className="mt-8">
          <CardContent className="p-6">
            <h2 className="flex items-center gap-2 font-semibold"><Target className="h-5 w-5 text-primary" /> Visi</h2>
            <p className="mt-2 text-muted-foreground">{org.vision}</p>
          </CardContent>
        </Card>
      )}

      {org && org.mission.length > 0 && (
        <Card className="mt-4">
          <CardContent className="p-6">
            <h2 className="flex items-center gap-2 font-semibold"><ListChecks className="h-5 w-5 text-primary" /> Misi</h2>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
              {org.mission.map((m, i) => <li key={i}>{m}</li>)}
            </ul>
          </CardContent>
        </Card>
      )}

      {org && (
        <div className="mt-8 grid gap-4 text-sm sm:grid-cols-2">
          {org.founded_year && (
            <div className="rounded-lg border p-4">
              <p className="text-muted-foreground">Berdiri sejak</p>
              <p className="text-lg font-semibold">{org.founded_year}</p>
            </div>
          )}
          {org.contact_email && (
            <div className="rounded-lg border p-4">
              <p className="text-muted-foreground">Email</p>
              <p className="text-lg font-semibold">{org.contact_email}</p>
            </div>
          )}
          {org.contact_phone && (
            <div className="rounded-lg border p-4">
              <p className="text-muted-foreground">Telepon/WA</p>
              <p className="text-lg font-semibold">{org.contact_phone}</p>
            </div>
          )}
          {org.address && (
            <div className="rounded-lg border p-4">
              <p className="text-muted-foreground">Alamat</p>
              <p className="text-lg font-semibold">{org.address}</p>
            </div>
          )}
        </div>
      )}

      {data && data.achievements.length > 0 && (
        <div className="mt-10">
          <h2 className="mb-4 flex items-center gap-2 text-xl font-bold">
            <Trophy className="h-5 w-5 text-primary" /> Prestasi
          </h2>
          <div className="space-y-3">
            {data.achievements.map((a) => (
              <Card key={a.id}>
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">{a.year} · {a.category}</p>
                  <p className="font-semibold">{a.title}</p>
                  {a.description && <p className="mt-1 text-sm text-muted-foreground">{a.description}</p>}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
