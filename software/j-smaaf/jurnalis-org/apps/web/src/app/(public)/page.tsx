import Link from 'next/link'
import { ArrowRight, Newspaper, Users, Trophy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { getPublicOrg, getPublicNews } from '@/lib/server-api'
import { formatDate } from '@/lib/utils'
import { CONTENT_CATEGORY_LABELS } from '@jurnalis-org/shared/constants'

export default async function LandingPage() {
  const orgData = await getPublicOrg()
  const news = await getPublicNews(1)
  const org = orgData?.org

  return (
    <div>
      <section className="bg-primary/5 py-20 text-center">
        <div className="mx-auto max-w-3xl px-4">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            {org?.name ?? 'Jurnalis Org'}
          </h1>
          <p className="mt-4 text-lg text-muted-foreground">
            {org?.tagline ?? 'Platform organisasi jurnalistik sekolah'}
          </p>
          <div className="mt-8 flex justify-center gap-3">
            <Button asChild size="lg">
              <Link href="/news">Baca Berita <ArrowRight className="ml-2 h-4 w-4" /></Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/about">Tentang Kami</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-16">
        <div className="mb-8 flex items-center justify-between">
          <h2 className="text-2xl font-bold">Berita Terbaru</h2>
          <Link href="/news" className="flex items-center gap-1 text-sm text-primary hover:underline">
            Semua berita <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        {!news || news.data.length === 0 ? (
          <p className="py-10 text-center text-muted-foreground">Belum ada berita yang diterbitkan.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {news.data.slice(0, 3).map((item) => (
              <Link key={item.id} href={`/news/${item.slug}`}>
                <Card className="h-full transition-shadow hover:shadow-md">
                  <CardContent className="p-4">
                    <p className="text-xs text-primary">{CONTENT_CATEGORY_LABELS[item.category] ?? item.category}</p>
                    <p className="mt-1 line-clamp-2 font-semibold">{item.title}</p>
                    <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{item.excerpt}</p>
                    <p className="mt-3 text-xs text-muted-foreground">{formatDate(item.published_at)}</p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>

      {orgData && orgData.achievements.length > 0 && (
        <section className="bg-secondary/30 py-16">
          <div className="mx-auto max-w-5xl px-4">
            <h2 className="mb-8 flex items-center gap-2 text-2xl font-bold">
              <Trophy className="h-6 w-6 text-primary" /> Prestasi
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {orgData.achievements.slice(0, 6).map((a) => (
                <Card key={a.id}>
                  <CardContent className="p-4">
                    <p className="text-xs text-muted-foreground">{a.year} · {a.category}</p>
                    <p className="mt-1 font-semibold">{a.title}</p>
                    {a.description && <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{a.description}</p>}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="mx-auto max-w-5xl px-4 py-16 text-center">
        <Users className="mx-auto mb-4 h-10 w-10 text-primary" />
        <h2 className="text-2xl font-bold">Bergabung dengan Kami</h2>
        <p className="mx-auto mt-2 max-w-md text-muted-foreground">
          Tertarik jadi bagian tim jurnalistik sekolah? Daftar sekarang atau hubungi pengurus.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Button asChild><Link href="/register">Daftar</Link></Button>
          <Button asChild variant="outline"><Link href="/contact">Kontak</Link></Button>
        </div>
        <Newspaper className="mx-auto mt-12 h-5 w-5 text-muted-foreground/30" />
      </section>
    </div>
  )
}
