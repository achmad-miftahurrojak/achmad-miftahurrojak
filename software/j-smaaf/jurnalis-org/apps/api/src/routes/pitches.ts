import type { FastifyInstance } from 'fastify'
import { prisma } from '../lib/prisma'
import { pitchFormSchema, pitchVoteSchema, pitchStatusSchema } from '@jurnalis-org/shared/validations/pitches'
import { ADMIN_OR_KETUA, PAGE_SIZES } from '@jurnalis-org/shared/constants'

export default async function pitchRoutes(fastify: FastifyInstance) {
  fastify.get('/', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const query = request.query as { page?: string }
    const page = Math.max(1, Number(query.page ?? 1))
    const userId = request.currentUser.id
    try {
      const [items, total] = await Promise.all([
        prisma.pitch.findMany({
          include: {
            author: { select: { id: true, full_name: true, avatar_url: true } },
            votes: { where: { profile_id: userId }, select: { vote: true } },
          },
          orderBy: [{ upvotes: 'desc' }, { created_at: 'desc' }],
          skip: (page - 1) * PAGE_SIZES.pitches,
          take: PAGE_SIZES.pitches,
        }),
        prisma.pitch.count(),
      ])
      return reply.send({
        data: items.map((p) => ({ ...p, votes: undefined, my_vote: p.votes[0]?.vote ?? 0 })),
        meta: { total, page, totalPages: Math.ceil(total / PAGE_SIZES.pitches) },
      })
    } catch (err) {
      fastify.log.error({ err }, '[pitches] list gagal')
      return reply.status(500).send({ error: 'Terjadi kesalahan server' })
    }
  })

  fastify.get('/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    try {
      const pitch = await prisma.pitch.findUnique({
        where: { id },
        include: {
          author: { select: { id: true, full_name: true, avatar_url: true } },
          votes: { where: { profile_id: request.currentUser.id }, select: { vote: true } },
        },
      })
      if (!pitch) return reply.status(404).send({ error: 'Pitch tidak ditemukan' })
      return reply.send({ pitch: { ...pitch, votes: undefined, my_vote: pitch.votes[0]?.vote ?? 0 } })
    } catch (err) {
      fastify.log.error({ err }, '[pitches] detail gagal')
      return reply.status(500).send({ error: 'Terjadi kesalahan server' })
    }
  })

  fastify.post('/', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const parsed = pitchFormSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.issues[0]?.message ?? 'Data tidak valid' })
    }
    try {
      const pitch = await prisma.pitch.create({
        data: { ...parsed.data, author_id: request.currentUser.id, status: 'open' },
      })
      return reply.status(201).send({ pitch })
    } catch (err) {
      fastify.log.error({ err }, '[pitches] create gagal')
      return reply.status(500).send({ error: 'Terjadi kesalahan server' })
    }
  })

  fastify.post('/:id/vote', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const parsed = pitchVoteSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Vote tidak valid' })
    }
    const userId = request.currentUser.id
    const { vote } = parsed.data
    try {
      const result = await prisma.$transaction(async (tx) => {
        const existing = await tx.pitchVote.findUnique({
          where: { pitch_id_profile_id: { pitch_id: id, profile_id: userId } },
        })
        if (existing && existing.vote === vote) {
          await tx.pitchVote.delete({ where: { pitch_id_profile_id: { pitch_id: id, profile_id: userId } } })
        } else {
          await tx.pitchVote.upsert({
            where: { pitch_id_profile_id: { pitch_id: id, profile_id: userId } },
            create: { pitch_id: id, profile_id: userId, vote },
            update: { vote },
          })
        }
        const [upvotes, downvotes] = await Promise.all([
          tx.pitchVote.count({ where: { pitch_id: id, vote: 1 } }),
          tx.pitchVote.count({ where: { pitch_id: id, vote: -1 } }),
        ])
        return tx.pitch.update({ where: { id }, data: { upvotes, downvotes } })
      })
      return reply.send({ pitch: result })
    } catch (err) {
      fastify.log.error({ err }, '[pitches] vote gagal')
      return reply.status(500).send({ error: 'Terjadi kesalahan server' })
    }
  })

  fastify.patch('/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    try {
      const existing = await prisma.pitch.findUnique({ where: { id }, select: { author_id: true } })
      if (!existing) return reply.status(404).send({ error: 'Pitch tidak ditemukan' })
      const isOwner = existing.author_id === request.currentUser.id
      const isAdmin = (ADMIN_OR_KETUA as readonly string[]).includes(request.currentUser.role)
      if (!isOwner && !isAdmin) return reply.status(403).send({ error: 'Akses ditolak' })

      const statusParsed = pitchStatusSchema.safeParse(request.body)
      if (statusParsed.success && isAdmin) {
        const pitch = await prisma.pitch.update({ where: { id }, data: { status: statusParsed.data.status } })
        return reply.send({ pitch })
      }
      const formParsed = pitchFormSchema.partial().safeParse(request.body)
      if (!formParsed.success) {
        return reply.status(400).send({ error: formParsed.error.issues[0]?.message ?? 'Data tidak valid' })
      }
      const pitch = await prisma.pitch.update({ where: { id }, data: formParsed.data })
      return reply.send({ pitch })
    } catch (err) {
      fastify.log.error({ err }, '[pitches] update gagal')
      return reply.status(500).send({ error: 'Terjadi kesalahan server' })
    }
  })
}
