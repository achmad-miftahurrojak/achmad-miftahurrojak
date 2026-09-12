import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { prisma } from '../lib/prisma'
import { sendTaskAssigned } from '../lib/notifications'

async function cronAuth(request: FastifyRequest, reply: FastifyReply) {
  const auth = request.headers.authorization
  if (!auth || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return reply.status(401).send({ error: 'Unauthorized' })
  }
}

export default async function cronRoutes(fastify: FastifyInstance) {
  // Dipanggil cron eksternal (mis. cron-job.org) agar Neon & Render tidak tidur
  fastify.get('/keep-alive', { preHandler: [cronAuth] }, async (_request, reply) => {
    try {
      await prisma.$queryRaw`SELECT 1`
      return reply.send({ ok: true, ts: new Date().toISOString() })
    } catch (err) {
      fastify.log.error({ err }, '[cron] keep-alive gagal')
      return reply.status(500).send({ error: 'DB ping gagal' })
    }
  })

  // Ingatkan tugas yang deadline dalam 3 hari
  fastify.get('/deadline-check', { preHandler: [cronAuth] }, async (_request, reply) => {
    try {
      const now = new Date()
      const threeDays = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
      const tasks = await prisma.task.findMany({
        where: {
          due_date: { gte: now, lte: threeDays },
          status: { in: ['pending', 'in_progress', 'revision'] },
          assigned_to: { not: null },
        },
        select: { id: true, title: true, due_date: true, assigned_to: true },
      })
      let sent = 0
      for (const task of tasks) {
        if (!task.assigned_to) continue
        await sendTaskAssigned(fastify, {
          recipientId: task.assigned_to,
          taskTitle: task.title,
          taskId: task.id,
          dueDate: task.due_date?.toLocaleDateString('id-ID') ?? null,
        })
        sent++
      }
      return reply.send({ ok: true, reminders: sent })
    } catch (err) {
      fastify.log.error({ err }, '[cron] deadline-check gagal')
      return reply.status(500).send({ error: 'Terjadi kesalahan server' })
    }
  })
}
