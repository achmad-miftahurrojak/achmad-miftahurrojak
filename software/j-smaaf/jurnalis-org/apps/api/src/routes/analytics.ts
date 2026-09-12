import type { FastifyInstance } from 'fastify'
import { prisma } from '../lib/prisma'
import { analyticsTrackSchema } from '@jurnalis-org/shared/validations/users'
import { ANALYTICS_ACCESS } from '@jurnalis-org/shared/constants'

export default async function analyticsRoutes(fastify: FastifyInstance) {
  fastify.post('/track', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const parsed = analyticsTrackSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Data tidak valid' })
    }
    try {
      await prisma.analyticsEvent.create({
        data: {
          event_type: parsed.data.event_type,
          entity_type: parsed.data.entity_type,
          entity_id: parsed.data.entity_id,
          actor_id: request.currentUser.id,
          metadata: parsed.data.metadata as never,
        },
      })
      return reply.status(201).send({ ok: true })
    } catch (err) {
      fastify.log.error({ err }, '[analytics] track gagal')
      return reply.status(500).send({ error: 'Terjadi kesalahan server' })
    }
  })

  fastify.get('/overview', { preHandler: [fastify.authenticate, fastify.requireRole(ANALYTICS_ACCESS)] }, async (_request, reply) => {
    try {
      const viewsPerDay = await prisma.$queryRaw<{ day: string; views: string }[]>`
        SELECT TO_CHAR(DATE_TRUNC('day', created_at), 'YYYY-MM-DD') AS day, COUNT(*)::text AS views
        FROM analytics_events
        WHERE event_type = 'content_view' AND created_at >= NOW() - INTERVAL '7 days'
        GROUP BY 1 ORDER BY 1`
      const topContent = await prisma.$queryRaw<{ id: string; title: string; views: string }[]>`
        SELECT c.id, c.title, COUNT(a.id)::text AS views
        FROM analytics_events a
        JOIN content_cards c ON c.id = a.entity_id
        WHERE a.event_type = 'content_view' AND a.created_at >= NOW() - INTERVAL '7 days'
        GROUP BY c.id, c.title
        ORDER BY COUNT(a.id) DESC
        LIMIT 5`
      const taskCompletions = await prisma.$queryRaw<{ day: string; count: string }[]>`
        SELECT TO_CHAR(DATE_TRUNC('day', created_at), 'YYYY-MM-DD') AS day, COUNT(*)::text AS count
        FROM analytics_events
        WHERE event_type = 'task_completed' AND created_at >= NOW() - INTERVAL '7 days'
        GROUP BY 1 ORDER BY 1`
      const totals = await prisma.analyticsEvent.groupBy({
        by: ['event_type'],
        _count: true,
        where: { created_at: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
      })
      const totalsMap: Record<string, number> = {}
      for (const t of totals) totalsMap[t.event_type] = t._count
      return reply.send({
        viewsPerDay: viewsPerDay.map((v) => ({ day: v.day, views: Number(v.views) })),
        topContent: topContent.map((c) => ({ id: c.id, title: c.title, views: Number(c.views) })),
        taskCompletions: taskCompletions.map((t) => ({ day: t.day, count: Number(t.count) })),
        totals: totalsMap,
      })
    } catch (err) {
      fastify.log.error({ err }, '[analytics] overview gagal')
      return reply.status(500).send({ error: 'Terjadi kesalahan server' })
    }
  })
}
