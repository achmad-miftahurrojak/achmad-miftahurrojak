import type { FastifyInstance } from 'fastify'
import { prisma } from '../lib/prisma'
import { alumniProfileSchema } from '@jurnalis-org/shared/validations/notifications'
import { PAGE_SIZES } from '@jurnalis-org/shared/constants'

export default async function alumniRoutes(fastify: FastifyInstance) {
  fastify.get('/', async (request, reply) => {
    const query = request.query as { page?: string; angkatan?: string }
    const page = Math.max(1, Number(query.page ?? 1))
    const where: Record<string, unknown> = { role: 'alumni', is_active: true }
    if (query.angkatan) where.angkatan = Number(query.angkatan)
    try {
      const [items, total, years] = await Promise.all([
        prisma.user.findMany({
          where,
          select: {
            id: true, full_name: true, nickname: true, avatar_url: true,
            angkatan: true, graduation_year: true, current_job: true, bio: true,
            alumni_connection: {
              select: { company: true, linkedin_url: true, is_mentor: true, mentor_fields: true },
            },
          },
          orderBy: [{ angkatan: 'desc' }, { full_name: 'asc' }],
          skip: (page - 1) * PAGE_SIZES.alumni,
          take: PAGE_SIZES.alumni,
        }),
        prisma.user.count({ where }),
        prisma.user.findMany({
          where: { role: 'alumni', angkatan: { not: null } },
          select: { angkatan: true },
          distinct: ['angkatan'],
          orderBy: { angkatan: 'desc' },
        }),
      ])
      return reply.send({
        data: items,
        meta: { total, page, totalPages: Math.ceil(total / PAGE_SIZES.alumni) },
        years: years.map((y) => y.angkatan).filter((y): y is number => y !== null),
      })
    } catch (err) {
      fastify.log.error({ err }, '[alumni] list gagal')
      return reply.status(500).send({ error: 'Terjadi kesalahan server' })
    }
  })

  fastify.get('/me', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    try {
      const profile = await prisma.alumniConnection.findUnique({
        where: { profile_id: request.currentUser.id },
      })
      return reply.send({ profile })
    } catch (err) {
      fastify.log.error({ err }, '[alumni] me gagal')
      return reply.status(500).send({ error: 'Terjadi kesalahan server' })
    }
  })

  fastify.put('/me', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const parsed = alumniProfileSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.issues[0]?.message ?? 'Data tidak valid' })
    }
    try {
      const profile = await prisma.alumniConnection.upsert({
        where: { profile_id: request.currentUser.id },
        create: { profile_id: request.currentUser.id, ...parsed.data },
        update: parsed.data,
      })
      return reply.send({ profile })
    } catch (err) {
      fastify.log.error({ err }, '[alumni] update me gagal')
      return reply.status(500).send({ error: 'Terjadi kesalahan server' })
    }
  })
}
