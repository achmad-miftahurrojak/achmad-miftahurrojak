import { UserAvatar } from '@/components/ui/user-avatar'
import { getPublicOrg } from '@/lib/server-api'

export const metadata = { title: 'Struktur Organisasi' }

export default async function StructurePage() {
  const data = await getPublicOrg()
  const structure = data?.structure ?? []
  const byYear = new Map<number, typeof structure>()
  for (const entry of structure) {
    if (!byYear.has(entry.period_year)) byYear.set(entry.period_year, [])
    byYear.get(entry.period_year)!.push(entry)
  }
  const years = Array.from(byYear.keys()).sort((a, b) => b - a)

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-bold">Struktur Organisasi</h1>
      {years.length === 0 ? (
        <p className="mt-8 text-muted-foreground">Struktur organisasi belum dipublikasikan.</p>
      ) : (
        years.map((year) => (
          <div key={year} className="mt-8">
            <h2 className="text-lg font-semibold">Periode {year}</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {byYear.get(year)!.map((entry) => (
                <div key={entry.id} className="flex items-center gap-3 rounded-lg border p-3">
                  <UserAvatar name={entry.profile.full_name} url={entry.profile.avatar_url} />
                  <div>
                    <p className="text-sm font-medium">{entry.profile.nickname ?? entry.profile.full_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {entry.position}{entry.division ? ` · ${entry.division}` : ''}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  )
}
