import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Eye } from 'lucide-react'
import type { Metadata } from 'next'
import { LikeButton } from '@/components/public/like-button'
import { getPublicNewsItem } from '@/lib/server-api'
import { formatDate } from '@/lib/utils'
import { CONTENT_CATEGORY_LABELS } from '@jurnalis-org/shared/constants'

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const data = await getPublicNewsItem(slug)
  if (!data) return { title: 'Tidak ditemukan' }
  return {
    title: data.item.seo_title ?? data.item.title,
    description: data.item.seo_desc ?? data.item.excerpt ?? undefined,
  }
}

export default async function NewsDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const data = await getPublicNewsItem(slug)
  if (!data) notFound()
  const { item } = data

  return (
    <article className="mx-auto max-w-3xl px-4 py-10">
      <Link href="/news" className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Semua berita
      </Link>
      <p className="text-sm text-primary">{CONTENT_CATEGORY_LABELS[item.category] ?? item.category}</p>
      <h1 className="mt-2 text-3xl font-bold leading-tight">{item.title}</h1>
      <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
        <span>{item.author?.nickname ?? item.author?.full_name ?? 'Redaksi'}</span>
        <span>·</span>
        <span>{formatDate(item.published_at)}</span>
        <span className="flex items-center gap-1"><Eye className="h-4 w-4" />{item.views}</span>
      </div>
      {item.cover_image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={item.cover_image} alt={item.title} className="mt-6 w-full rounded-lg object-cover" />
      )}
      <div className="article-content mt-6" dangerouslySetInnerHTML={{ __html: item.content }} />
      {item.youtube_id && (
        <div className="mt-6 aspect-video">
          <iframe src={`https://www.youtube.com/embed/${item.youtube_id}`}
            className="h-full w-full rounded-lg" allowFullScreen title="Video" />
        </div>
      )}
      <div className="mt-8 flex items-center gap-3 border-t pt-6">
        <LikeButton contentId={item.id} initialLikes={item.likes} />
        {item.tags.map((tag) => (
          <span key={tag} className="rounded-full bg-secondary px-3 py-1 text-xs">#{tag}</span>
        ))}
      </div>
    </article>
  )
}
