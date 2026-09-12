// Fetch server-to-server (Server Component) — TIDAK lewat proxy /api, langsung ke BACKEND_URL
const BACKEND_URL = process.env.BACKEND_URL ?? 'http://localhost:4000'

async function serverFetch<T>(path: string, revalidate = 3600): Promise<T | null> {
  try {
    const res = await fetch(`${BACKEND_URL}${path}`, { next: { revalidate } })
    if (!res.ok) return null
    return (await res.json()) as T
  } catch {
    return null
  }
}

export interface OrgProfileData {
  id: string
  name: string
  tagline: string | null
  vision: string | null
  mission: string[]
  founded_year: number | null
  logo_url: string | null
  cover_url: string | null
  contact_email: string | null
  contact_phone: string | null
  address: string | null
}

export interface AchievementData {
  id: string
  title: string
  category: string
  year: number
  description: string | null
  image_url: string | null
}

export interface StructureEntry {
  id: string
  position: string
  division: string | null
  period_year: number
  order_index: number
  profile: { full_name: string; nickname: string | null; avatar_url: string | null }
}

export interface FaqData {
  id: string
  question: string
  answer: string
  category: string | null
  order_index: number
}

export interface SopDoc {
  id: string
  title: string
  content: string
  category: string | null
  order_index: number
}

export function getPublicOrg() {
  return serverFetch<{ org: OrgProfileData | null; achievements: AchievementData[]; structure: StructureEntry[] }>('/api/content/public/org')
}

export function getPublicFaqs() {
  return serverFetch<{ data: FaqData[] }>('/api/content/public/faqs')
}

export function getPublicSop() {
  return serverFetch<{ data: SopDoc[] }>('/api/content/public/sop')
}

export function getPublicNews(page = 1, category?: string) {
  const params = new URLSearchParams({ page: String(page) })
  if (category) params.set('category', category)
  return serverFetch<{ data: PublicNewsItem[]; meta: { total: number; page: number; totalPages: number } }>(
    `/api/content/public/news?${params}`,
    300,
  )
}

export function getPublicNewsItem(slug: string) {
  return serverFetch<{ item: PublicNewsDetail }>(`/api/content/public/news/${slug}`, 300)
}

export interface PublicNewsItem {
  id: string
  title: string
  slug: string
  excerpt: string | null
  category: string
  cover_image: string | null
  published_at: string | null
  views: number
  likes: number
  tags: string[]
  author: { full_name: string; nickname: string | null } | null
}

export interface PublicNewsDetail extends PublicNewsItem {
  content: string
  youtube_id: string | null
  seo_title: string | null
  seo_desc: string | null
  author: { full_name: string; nickname: string | null; avatar_url: string | null } | null
}
