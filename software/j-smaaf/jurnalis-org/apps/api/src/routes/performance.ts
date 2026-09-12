import type { FastifyInstance } from 'fastify'
import { prisma } from '../lib/prisma'
import { PENGURUS_OR_ABOVE } from '@jurnalis-org/shared/constants'

export default async function performanceRoutes(fastify: FastifyInstance) {
  fastify.get('/', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const query = request.query as { period_id?: string }
    try {
      let period = query.period_id
        ? await prisma.performancePeriod.findUnique({ where: { id: query.period_id } })
        : await prisma.performancePeriod.findFirst({ where: { is_active: true } })
      if (!period) {
        period = await prisma.performancePeriod.findFirst({ orderBy: { start_date: 'desc' } })
      }
      if (!period) return reply.send({ period: null, records: [] })
      const records = await prisma.performanceRecord.findMany({
        where: { period_id: period.id },
        include: { profile: { select: { id: true, full_name: true, nickname: true, avatar_url: true, division: true } } },
        orderBy: { overall_score: 'desc' },
      })
      return reply.send({
        period,
        records: records.map((r) => ({ ...r, overall_score: Number(r.overall_score) })),
      })
    } catch (err) {
      fastify.log.error({ err }, '[performance] list gagal')
      return reply.status(500).send({ error: 'Terjadi kesalahan server' })
    }
  })

  fastify.get('/:userId', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { userId } = request.params as { userId: string }
    const isSelf = userId === request.currentUser.id
    const isManager = (PENGURUS_OR_ABOVE as readonly string[]).includes(request.currentUser.role)
    if (!isSelf && !isManager) return reply.status(403).send({ error: 'Akses ditolak' })
    try {
      const records = await prisma.performanceRecord.findMany({
        where: { profile_id: userId },
        include: { period: true },
        orderBy: { period: { start_date: 'desc' } },
      })
      return reply.send({ records: records.map((r) => ({ ...r, overall_score: Number(r.overall_score) })) })
    } catch (err) {
      fastify.log.error({ err }, '[performance] detail gagal')
      return reply.status(500).send({ error: 'Terjadi kesalahan server' })
    }
  })

  fastify.post('/recalculate', { preHandler: [fastify.authenticate, fastify.requireRole(PENGURUS_OR_ABOVE)] }, async (_request, reply) => {
    try {
      const period = await prisma.performancePeriod.findFirst({ where: { is_active: true } })
      if (!period) return reply.status(400).send({ error: 'Tidak ada periode aktif' })

      const members = await prisma.user.findMany({
        where: { is_active: true, role: { in: ['anggota', 'pengurus', 'bendahara', 'redaktur'] } },
        select: { id: true },
      })

      // Pass 1: kumpulkan metrik mentah semua anggota
      const metrics: {
        profileId: string
        tasksCompleted: number
        tasksOnTime: number
        tasksLate: number
        totalWeight: number
        attendanceTotal: number
        attendanceHadir: number
        contentPublished: number
      }[] = []

      for (const member of members) {
        const tasks = await prisma.task.findMany({
          where: {
            assigned_to: member.id,
            status: 'completed',
            completed_at: { gte: period.start_date, lte: period.end_date },
          },
          select: { weight: true, due_date: true, completed_at: true },
        })
        const tasksCompleted = tasks.length
        const tasksOnTime = tasks.filter((t) => !t.due_date || (t.completed_at && t.completed_at <= t.due_date)).length
        const totalWeight = tasks.reduce((sum, t) => sum + t.weight, 0)
        const attendanceTotal = await prisma.attendance.count({
          where: { profile_id: member.id, meeting: { start_time: { gte: period.start_date, lte: period.end_date } } },
        })
        const attendanceHadir = await prisma.attendance.count({
          where: {
            profile_id: member.id,
            status: 'hadir',
            meeting: { start_time: { gte: period.start_date, lte: period.end_date } },
          },
        })
        const contentPublished = await prisma.contentCard.count({
          where: {
            author_id: member.id,
            status: 'published',
            published_at: { gte: period.start_date, lte: period.end_date },
          },
        })
        metrics.push({
          profileId: member.id,
          tasksCompleted,
          tasksOnTime,
          tasksLate: tasksCompleted - tasksOnTime,
          totalWeight,
          attendanceTotal,
          attendanceHadir,
          contentPublished,
        })
      }

      // SCORE FORMULA (v3.0):
      //   tasks_weight_score = (total_weight / max_weight_period) * 40
      //   attendance_score   = (hadir / total_meetings) * 30
      //   ontime_score       = (tasks_on_time / tasks_completed) * 20
      //   content_score      = (content_published * 5) capped at 10
      //   overall_score      = sum, max 100
      const maxWeight = Math.max(...metrics.map((m) => m.totalWeight), 1)

      for (const m of metrics) {
        const taskScore = (m.totalWeight / maxWeight) * 40
        const attendanceScore = m.attendanceTotal > 0 ? (m.attendanceHadir / m.attendanceTotal) * 30 : 0
        const onTimeScore = m.tasksCompleted > 0 ? (m.tasksOnTime / m.tasksCompleted) * 20 : 0
        const contentScore = Math.min(m.contentPublished * 5, 10)
        const overall = Math.min(taskScore + attendanceScore + onTimeScore + contentScore, 100)

        await prisma.performanceRecord.upsert({
          where: { profile_id_period_id: { profile_id: m.profileId, period_id: period.id } },
          create: {
            profile_id: m.profileId,
            period_id: period.id,
            tasks_completed: m.tasksCompleted,
            tasks_on_time: m.tasksOnTime,
            tasks_late: m.tasksLate,
            total_weight: m.totalWeight,
            attendance_total: m.attendanceTotal,
            attendance_hadir: m.attendanceHadir,
            content_published: m.contentPublished,
            overall_score: Math.round(overall * 100) / 100,
          },
          update: {
            tasks_completed: m.tasksCompleted,
            tasks_on_time: m.tasksOnTime,
            tasks_late: m.tasksLate,
            total_weight: m.totalWeight,
            attendance_total: m.attendanceTotal,
            attendance_hadir: m.attendanceHadir,
            content_published: m.contentPublished,
            overall_score: Math.round(overall * 100) / 100,
          },
        })
      }
      return reply.send({ ok: true, processed: metrics.length })
    } catch (err) {
      fastify.log.error({ err }, '[performance] recalculate gagal')
      return reply.status(500).send({ error: 'Terjadi kesalahan server' })
    }
  })
}
