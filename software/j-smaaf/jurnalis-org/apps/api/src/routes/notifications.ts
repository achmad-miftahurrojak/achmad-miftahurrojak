import type { FastifyInstance } from 'fastify'
import { prisma } from '../lib/prisma'
import { notificationPayloadSchema, notificationPrefSchema } from '@jurnalis-org/shared/validations/notifications'
import { ADMIN_OR_KETUA, PAGE_SIZES } from '@jurnalis-org/shared/constants'
import { sendNotification } from '../lib/notifications'

export default async function notificationRoutes(fastify: FastifyInstance) {
  fastify.post('/', { preHandler: [fastify.authenticate, fastify.requireRole(ADMIN_OR_KETUA)] }, async (request, reply) => {
    const parsed = notificationPayloadSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.issues[0]?.message ?? 'Data tidak valid' })
    }
    await sendNotification(fastify, parsed.data)
    return reply.status(202).send({ ok: true })
  })

  fastify.get('/', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const query = request.query as { cursor?: string }
    try {
      const items = await prisma.notification.findMany({
        where: { recipient_id: request.currentUser.id },
        orderBy: { created_at: 'desc' },
        take: PAGE_SIZES.notifications + 1,
        ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      })
      const hasMore = items.length > PAGE_SIZES.notifications
      const data = hasMore ? items.slice(0, PAGE_SIZES.notifications) : items
      return reply.send({ data, nextCursor: hasMore ? data[data.length - 1]?.id : null })
    } catch (err) {
      fastify.log.error({ err }, '[notifications] list gagal')
      return reply.status(500).send({ error: 'Terjadi kesalahan server' })
    }
  })

  fastify.get('/unread-count', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    try {
      const count = await prisma.notification.count({
        where: { recipient_id: request.currentUser.id, read_at: null },
      })
      return reply.send({ count })
    } catch (err) {
      fastify.log.error({ err }, '[notifications] unread count gagal')
      return reply.status(500).send({ error: 'Terjadi kesalahan server' })
    }
  })

  fastify.post('/:id/read', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    try {
      await prisma.notification.updateMany({
        where: { id, recipient_id: request.currentUser.id },
        data: { read_at: new Date(), status: 'read' },
      })
      return reply.send({ ok: true })
    } catch (err) {
      fastify.log.error({ err }, '[notifications] mark read gagal')
      return reply.status(500).send({ error: 'Terjadi kesalahan server' })
    }
  })

  fastify.post('/read-all', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    try {
      await prisma.notification.updateMany({
        where: { recipient_id: request.currentUser.id, read_at: null },
        data: { read_at: new Date(), status: 'read' },
      })
      return reply.send({ ok: true })
    } catch (err) {
      fastify.log.error({ err }, '[notifications] mark all read gagal')
      return reply.status(500).send({ error: 'Terjadi kesalahan server' })
    }
  })

  fastify.post('/preferences', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const parsed = notificationPrefSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Data tidak valid' })
    }
    try {
      const pref = await prisma.notificationPreference.upsert({
        where: {
          profile_id_notif_type: { profile_id: request.currentUser.id, notif_type: parsed.data.notif_type },
        },
        create: { profile_id: request.currentUser.id, ...parsed.data },
        update: {
          in_app: parsed.data.in_app,
          whatsapp: parsed.data.whatsapp,
          email: parsed.data.email,
        },
      })
      return reply.send({ pref })
    } catch (err) {
      fastify.log.error({ err }, '[notifications] preferences gagal')
      return reply.status(500).send({ error: 'Terjadi kesalahan server' })
    }
  })
}
