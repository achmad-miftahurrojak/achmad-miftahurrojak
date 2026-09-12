import type { FastifyInstance } from 'fastify'
import { prisma } from '../lib/prisma'
import { meetingFormSchema, attendanceFormSchema } from '@jurnalis-org/shared/validations/meetings'
import { PENGURUS_OR_ABOVE } from '@jurnalis-org/shared/constants'

export default async function meetingRoutes(fastify: FastifyInstance) {
  fastify.get('/', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const query = request.query as { from?: string; to?: string }
    const where: Record<string, unknown> = {}
    if (query.from || query.to) {
      where.start_time = {}
      if (query.from) (where.start_time as Record<string, unknown>).gte = new Date(query.from)
      if (query.to) (where.start_time as Record<string, unknown>).lte = new Date(query.to)
    }
    try {
      const meetings = await prisma.meeting.findMany({
        where,
        include: {
          creator: { select: { id: true, full_name: true } },
          _count: { select: { attendance: { where: { status: 'hadir' } } } },
        },
        orderBy: { start_time: 'asc' },
      })
      const data = meetings.map((m) => ({ ...m, hadir_count: m._count.attendance, _count: undefined }))
      return reply.send({ data })
    } catch (err) {
      fastify.log.error({ err }, '[meetings] list gagal')
      return reply.status(500).send({ error: 'Terjadi kesalahan server' })
    }
  })

  fastify.post('/', { preHandler: [fastify.authenticate, fastify.requireRole(PENGURUS_OR_ABOVE)] }, async (request, reply) => {
    const parsed = meetingFormSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.issues[0]?.message ?? 'Data tidak valid' })
    }
    const input = parsed.data
    try {
      const meeting = await prisma.meeting.create({
        data: {
          title: input.title,
          type: input.type,
          description: input.description,
          start_time: new Date(input.start_time),
          end_time: input.end_time ? new Date(input.end_time) : null,
          location: input.location,
          link: input.link || null,
          is_mandatory: input.is_mandatory,
          created_by: request.currentUser.id,
        },
      })
      return reply.status(201).send({ meeting })
    } catch (err) {
      fastify.log.error({ err }, '[meetings] create gagal')
      return reply.status(500).send({ error: 'Terjadi kesalahan server' })
    }
  })

  // Check-in mandiri: status 'hadir' hanya dalam window 30 menit sebelum-sesudah mulai
  fastify.post('/:id/checkin', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const parsed = attendanceFormSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.issues[0]?.message ?? 'Data tidak valid' })
    }
    try {
      const meeting = await prisma.meeting.findUnique({ where: { id } })
      if (!meeting) return reply.status(404).send({ error: 'Kegiatan tidak ditemukan' })
      if (meeting.is_closed) return reply.status(400).send({ error: 'Absensi sudah ditutup' })

      let status = parsed.data.status
      if (status === 'hadir') {
        const now = Date.now()
        const start = meeting.start_time.getTime()
        const withinWindow = now >= start - 30 * 60 * 1000 && now <= start + 30 * 60 * 1000
        if (!withinWindow) {
          return reply.status(400).send({ error: 'Check-in hadir hanya bisa 30 menit sebelum sampai 30 menit setelah mulai' })
        }
      }
      const attendance = await prisma.attendance.upsert({
        where: { meeting_id_profile_id: { meeting_id: id, profile_id: request.currentUser.id } },
        create: {
          meeting_id: id,
          profile_id: request.currentUser.id,
          status,
          proof_url: parsed.data.proof_url,
          notes: parsed.data.notes,
        },
        update: { status, proof_url: parsed.data.proof_url, notes: parsed.data.notes },
      })
      return reply.send({ attendance })
    } catch (err) {
      fastify.log.error({ err }, '[meetings] checkin gagal')
      return reply.status(500).send({ error: 'Terjadi kesalahan server' })
    }
  })

  // Pengurus menandai absensi anggota lain
  fastify.post('/:id/attendance/:userId', { preHandler: [fastify.authenticate, fastify.requireRole(PENGURUS_OR_ABOVE)] }, async (request, reply) => {
    const { id, userId } = request.params as { id: string; userId: string }
    const parsed = attendanceFormSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.issues[0]?.message ?? 'Data tidak valid' })
    }
    try {
      const attendance = await prisma.attendance.upsert({
        where: { meeting_id_profile_id: { meeting_id: id, profile_id: userId } },
        create: {
          meeting_id: id,
          profile_id: userId,
          status: parsed.data.status,
          notes: parsed.data.notes,
          checked_by: request.currentUser.id,
        },
        update: { status: parsed.data.status, notes: parsed.data.notes, checked_by: request.currentUser.id },
      })
      return reply.send({ attendance })
    } catch (err) {
      fastify.log.error({ err }, '[meetings] mark attendance gagal')
      return reply.status(500).send({ error: 'Terjadi kesalahan server' })
    }
  })

  fastify.get('/:id/attendance', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    try {
      const attendance = await prisma.attendance.findMany({
        where: { meeting_id: id },
        include: { profile: { select: { id: true, full_name: true, nickname: true, avatar_url: true, division: true } } },
        orderBy: { profile: { full_name: 'asc' } },
      })
      return reply.send({ data: attendance })
    } catch (err) {
      fastify.log.error({ err }, '[meetings] list attendance gagal')
      return reply.status(500).send({ error: 'Terjadi kesalahan server' })
    }
  })

  fastify.get('/:id/attendance/export', { preHandler: [fastify.authenticate, fastify.requireRole(PENGURUS_OR_ABOVE)] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    try {
      const meeting = await prisma.meeting.findUnique({ where: { id } })
      if (!meeting) return reply.status(404).send({ error: 'Kegiatan tidak ditemukan' })
      const attendance = await prisma.attendance.findMany({
        where: { meeting_id: id },
        include: { profile: { select: { full_name: true, division: true } } },
        orderBy: { profile: { full_name: 'asc' } },
      })
      const rows = attendance.map((a) =>
        [a.profile.full_name, a.profile.division ?? '', a.status, a.notes ?? ''].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','),
      )
      const csv = ['"Nama","Divisi","Status","Catatan"', ...rows].join('\n')
      return reply
        .header('Content-Type', 'text/csv; charset=utf-8')
        .header('Content-Disposition', `attachment; filename="absensi-${meeting.title.replace(/[^a-z0-9]/gi, '-')}.csv"`)
        .send(csv)
    } catch (err) {
      fastify.log.error({ err }, '[meetings] export attendance gagal')
      return reply.status(500).send({ error: 'Terjadi kesalahan server' })
    }
  })

  fastify.patch('/:id/close', { preHandler: [fastify.authenticate, fastify.requireRole(PENGURUS_OR_ABOVE)] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    try {
      const meeting = await prisma.meeting.update({ where: { id }, data: { is_closed: true } })
      return reply.send({ meeting })
    } catch (err) {
      fastify.log.error({ err }, '[meetings] close gagal')
      return reply.status(500).send({ error: 'Terjadi kesalahan server' })
    }
  })
}
