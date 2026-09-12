import type { FastifyInstance } from 'fastify'
import { prisma } from '../lib/prisma'
import { contentFormSchema, contentStageUpdateSchema, contentCalendarSchema } from '@jurnalis-org/shared/validations/content'
import { EDITORIAL_ACCESS, PAGE_SIZES } from '@jurnalis-org/shared/constants'

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-').slice(0, 80)
}

export default async function contentRoutes(fastify: FastifyInstance) {
  // ---------- PUBLIC ----------
  fastify.get('/public/news', async (request, reply) => {
    const query = request.query as { page?: string; category?: string }
    const page = Math.max(1, Number(query.page ?? 1))
    const where: Record<string, unknown> = { status: 'published' }
    if (query.category) where.category = query.category
    try {
      const [items, total] = await Promise.all([
        prisma.contentCard.findMany({
          where,
          select: {
            id: true, title: true, slug: true, excerpt: true, category: true,
            cover_image: true, published_at: true, views: true, likes: true, tags: true,
            author: { select: { full_name: true, nickname: true } },
          },
          orderBy: { published_at: 'desc' },
          skip: (page - 1) * PAGE_SIZES.news,
          take: PAGE_SIZES.news,
        }),
        prisma.contentCard.count({ where }),
      ])
      return reply.send({ data: items, meta: { total, page, totalPages: Math.ceil(total / PAGE_SIZES.news) } })
    } catch (err) {
      fastify.log.error({ err }, '[content] public news gagal')
      return reply.status(500).send({ error: 'Terjadi kesalahan server' })
    }
  })

  fastify.get('/public/news/:slug', async (request, reply) => {
    const { slug } = request.params as { slug: string }
    try {
      const item = await prisma.contentCard.findUnique({
        where: { slug },
        include: { author: { select: { full_name: true, nickname: true, avatar_url: true } } },
      })
      if (!item || item.status !== 'published') {
        return reply.status(404).send({ error: 'Konten tidak ditemukan' })
      }
      await prisma.contentCard.update({ where: { id: item.id }, data: { views: { increment: 1 } } })
      await prisma.analyticsEvent.create({
        data: { event_type: 'content_view', entity_type: 'content', entity_id: item.id, metadata: {} as never },
      })
      return reply.send({ item: { ...item, views: item.views + 1 } })
    } catch (err) {
      fastify.log.error({ err }, '[content] public news detail gagal')
      return reply.status(500).send({ error: 'Terjadi kesalahan server' })
    }
  })

  fastify.get('/public/org', async (_request, reply) => {
    try {
      const org = await prisma.orgProfile.findFirst()
      const achievements = await prisma.achievement.findMany({ orderBy: { year: 'desc' }, take: 20 })
      const currentYear = new Date().getFullYear()
      const structure = await prisma.orgStructure.findMany({
        where: { period_year: { gte: currentYear - 1 } },
        include: { profile: { select: { full_name: true, nickname: true, avatar_url: true } } },
        orderBy: [{ period_year: 'desc' }, { order_index: 'asc' }],
      })
      return reply.send({ org, achievements, structure })
    } catch (err) {
      fastify.log.error({ err }, '[content] public org gagal')
      return reply.status(500).send({ error: 'Terjadi kesalahan server' })
    }
  })

  fastify.get('/public/sop', async (_request, reply) => {
    try {
      const docs = await prisma.knowledgeBase.findMany({
        where: { is_public: true },
        select: { id: true, title: true, content: true, category: true, order_index: true },
        orderBy: { order_index: 'asc' },
      })
      return reply.send({ data: docs })
    } catch (err) {
      fastify.log.error({ err }, '[content] public sop gagal')
      return reply.status(500).send({ error: 'Terjadi kesalahan server' })
    }
  })

  fastify.get('/public/faqs', async (_request, reply) => {
    try {
      const faqs = await prisma.faq.findMany({ orderBy: { order_index: 'asc' } })
      return reply.send({ data: faqs })
    } catch (err) {
      fastify.log.error({ err }, '[content] public faqs gagal')
      return reply.status(500).send({ error: 'Terjadi kesalahan server' })
    }
  })

  // ---------- AUTH ----------
  fastify.post('/:id/like', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const userId = request.currentUser.id
    try {
      const result = await prisma.$transaction(async (tx) => {
        const existing = await tx.contentLike.findUnique({
          where: { content_id_profile_id: { content_id: id, profile_id: userId } },
        })
        if (existing) {
          await tx.contentLike.delete({ where: { content_id_profile_id: { content_id: id, profile_id: userId } } })
          const updated = await tx.contentCard.update({ where: { id }, data: { likes: { decrement: 1 } } })
          return { liked: false, likes: updated.likes }
        }
        await tx.contentLike.create({ data: { content_id: id, profile_id: userId } })
        const updated = await tx.contentCard.update({ where: { id }, data: { likes: { increment: 1 } } })
        return { liked: true, likes: updated.likes }
      })
      if (result.liked) {
        await prisma.analyticsEvent.create({
          data: { event_type: 'content_like', entity_type: 'content', entity_id: id, actor_id: userId, metadata: {} as never },
        })
      }
      return reply.send(result)
    } catch (err) {
      fastify.log.error({ err }, '[content] like gagal')
      return reply.status(500).send({ error: 'Terjadi kesalahan server' })
    }
  })

  fastify.get('/', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const query = request.query as { page?: string; status?: string }
    const page = Math.max(1, Number(query.page ?? 1))
    const where: Record<string, unknown> = {}
    const isEditor = (EDITORIAL_ACCESS as readonly string[]).includes(request.currentUser.role)
    if (!isEditor) where.author_id = request.currentUser.id
    if (query.status) where.status = query.status
    try {
      const [items, total] = await Promise.all([
        prisma.contentCard.findMany({
          where,
          select: {
            id: true, title: true, slug: true, excerpt: true, category: true, status: true,
            cover_image: true, published_at: true, views: true, likes: true, is_featured: true, updated_at: true,
            author: { select: { id: true, full_name: true, avatar_url: true } },
          },
          orderBy: { updated_at: 'desc' },
          skip: (page - 1) * PAGE_SIZES.content,
          take: PAGE_SIZES.content,
        }),
        prisma.contentCard.count({ where }),
      ])
      return reply.send({ data: items, meta: { total, page, totalPages: Math.ceil(total / PAGE_SIZES.content) } })
    } catch (err) {
      fastify.log.error({ err }, '[content] list gagal')
      return reply.status(500).send({ error: 'Terjadi kesalahan server' })
    }
  })

  fastify.get('/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    try {
      const item = await prisma.contentCard.findUnique({
        where: { id },
        include: {
          author: { select: { id: true, full_name: true, avatar_url: true } },
          editor: { select: { id: true, full_name: true } },
        },
      })
      if (!item) return reply.status(404).send({ error: 'Konten tidak ditemukan' })
      const isEditor = (EDITORIAL_ACCESS as readonly string[]).includes(request.currentUser.role)
      if (!isEditor && item.author_id !== request.currentUser.id) {
        return reply.status(403).send({ error: 'Akses ditolak' })
      }
      return reply.send({ item })
    } catch (err) {
      fastify.log.error({ err }, '[content] detail gagal')
      return reply.status(500).send({ error: 'Terjadi kesalahan server' })
    }
  })

  fastify.post('/', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const parsed = contentFormSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.issues[0]?.message ?? 'Data tidak valid' })
    }
    const input = parsed.data
    const slug = `${slugify(input.title)}-${Date.now().toString(36)}${crypto.randomUUID().slice(0, 4)}`
    try {
      const item = await prisma.contentCard.create({
        data: {
          title: input.title,
          slug,
          excerpt: input.excerpt,
          content: input.content,
          category: input.category,
          cover_image: input.cover_image,
          tags: input.tags,
          youtube_id: input.youtube_id,
          is_featured: input.is_featured,
          seo_title: input.seo_title,
          seo_desc: input.seo_desc,
          author_id: request.currentUser.id,
        },
      })
      return reply.status(201).send({ item })
    } catch (err) {
      fastify.log.error({ err }, '[content] create gagal')
      return reply.status(500).send({ error: 'Terjadi kesalahan server' })
    }
  })

  fastify.patch('/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const parsed = contentFormSchema.partial().safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.issues[0]?.message ?? 'Data tidak valid' })
    }
    try {
      const existing = await prisma.contentCard.findUnique({ where: { id }, select: { author_id: true } })
      if (!existing) return reply.status(404).send({ error: 'Konten tidak ditemukan' })
      const isEditor = (EDITORIAL_ACCESS as readonly string[]).includes(request.currentUser.role)
      if (!isEditor && existing.author_id !== request.currentUser.id) {
        return reply.status(403).send({ error: 'Akses ditolak' })
      }
      const item = await prisma.contentCard.update({
        where: { id },
        data: isEditor ? { ...parsed.data, editor_id: request.currentUser.id } : parsed.data,
      })
      return reply.send({ item })
    } catch (err) {
      fastify.log.error({ err }, '[content] update gagal')
      return reply.status(500).send({ error: 'Terjadi kesalahan server' })
    }
  })

  fastify.patch('/:id/stage', { preHandler: [fastify.authenticate, fastify.requireRole(EDITORIAL_ACCESS)] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const parsed = contentStageUpdateSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.issues[0]?.message ?? 'Data tidak valid' })
    }
    try {
      const item = await prisma.contentCard.update({
        where: { id },
        data: {
          status: parsed.data.status,
          editor_id: request.currentUser.id,
          published_at: parsed.data.status === 'published' ? new Date() : undefined,
        },
      })
      return reply.send({ item })
    } catch (err) {
      fastify.log.error({ err }, '[content] update stage gagal')
      return reply.status(500).send({ error: 'Terjadi kesalahan server' })
    }
  })

  fastify.delete('/:id', { preHandler: [fastify.authenticate, fastify.requireRole(['admin', 'ketua'])] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    try {
      await prisma.contentCard.delete({ where: { id } })
      return reply.send({ ok: true })
    } catch (err) {
      fastify.log.error({ err }, '[content] delete gagal')
      return reply.status(500).send({ error: 'Terjadi kesalahan server' })
    }
  })

  // ---------- CALENDAR ----------
  fastify.get('/calendar/list', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const query = request.query as { from?: string; to?: string }
    const where: Record<string, unknown> = {}
    if (query.from || query.to) {
      where.scheduled_at = {}
      if (query.from) (where.scheduled_at as Record<string, unknown>).gte = new Date(query.from)
      if (query.to) (where.scheduled_at as Record<string, unknown>).lte = new Date(query.to)
    }
    try {
      const entries = await prisma.contentCalendar.findMany({
        where,
        include: {
          content: { select: { id: true, title: true, slug: true, status: true } },
          assignee: { select: { id: true, full_name: true, avatar_url: true } },
        },
        orderBy: { scheduled_at: 'asc' },
      })
      return reply.send({ data: entries })
    } catch (err) {
      fastify.log.error({ err }, '[content] calendar list gagal')
      return reply.status(500).send({ error: 'Terjadi kesalahan server' })
    }
  })

  fastify.post('/calendar', { preHandler: [fastify.authenticate, fastify.requireRole(EDITORIAL_ACCESS)] }, async (request, reply) => {
    const parsed = contentCalendarSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.issues[0]?.message ?? 'Data tidak valid' })
    }
    try {
      const entry = await prisma.contentCalendar.create({
        data: {
          title: parsed.data.title,
          scheduled_at: new Date(parsed.data.scheduled_at),
          category: parsed.data.category,
          content_id: parsed.data.content_id,
          assignee_id: parsed.data.assignee_id,
          notes: parsed.data.notes,
        },
      })
      return reply.status(201).send({ entry })
    } catch (err) {
      fastify.log.error({ err }, '[content] calendar create gagal')
      return reply.status(500).send({ error: 'Terjadi kesalahan server' })
    }
  })
}
