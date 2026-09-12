import Link from 'next/link'
import { Newspaper } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { getPublicNews } from '@/lib/server-api'
import { formatDate } from '@/lib/utils'
import { CONTENT_CATEGORY_LABELS } from '@jurnalis-org/shared/constants'

export const metadata = { title: 'Berita' }

export default async function NewsPage({ searchParams }: { searchParams: Promise<{ page?: string; category?: string }> }) {
  const sp = await searchParams
  const page = Math.max(1, Number(sp.page ?? 1))
  const news = await getPublicNews(page, sp.category)

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="mb-8 text-3xl font-bold">Berita & Publikasi</h1>
      {!news || news.data.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-center">
          <Newspaper className="mb-3 h-10 w-10 text-muted-foreground/50" />
          <p className="text-muted-foreground">Belum ada berita yang diterbitkan.</p>
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {news.data.map((item) => (
              <Link key={item.id} href={`/news/${item.slug}`}>
                <Card className="h-full transition-shadow hover:shadow-md">
                  {item.cover_image && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.cover_image} alt={item.title} className="h-40 w-full rounded-t-lg object-cover" />
                  )}
                  <CardContent className="p-4">
                    <p className="text-xs text-primary">{CONTENT_CATEGORY_LABELS[item.category] ?? item.category}</p>
                    <p className="mt-1 line-clamp-2 font-semibold">{item.title}</p>
                    <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{item.excerpt}</p>
                    <p className="mt-3 text-xs text-muted-foreground">
                      {item.author?.nickname ?? item.author?.full_name ?? 'Redaksi'} · {formatDate(item.published_at)} · {item.views} views
                    </p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
          {news.meta.totalPages > 1 && (
            <div className="mt-8 flex items-center justify-center gap-2">
              {page > 1 && (
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/news?page=${page - 1}`}>Sebelumnya</Link>
                </Button>
              )}
              <span className="text-sm text-muted-foreground">Halaman {page} dari {news.meta.totalPages}</span>
              {page < news.meta.totalPages && (
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/news?page=${page + 1}`}>Berikutnya</Link>
                </Button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
