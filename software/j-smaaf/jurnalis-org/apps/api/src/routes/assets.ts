import type { FastifyInstance } from 'fastify'
import { prisma } from '../lib/prisma'
import { assetUploadSchema, assetUpdateSchema } from '@jurnalis-org/shared/validations/assets'
import { PENGURUS_OR_ABOVE, ADMIN_OR_KETUA, PAGE_SIZES } from '@jurnalis-org/shared/constants'

export default async function assetRoutes(fastify: FastifyInstance) {
  fastify.get('/', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const query = request.query as { page?: string; category?: string }
    const page = Math.max(1, Number(query.page ?? 1))
    const where: Record<string, unknown> = {}
    if (query.category) where.category = query.category
    try {
      const [items, total] = await Promise.all([
        prisma.asset.findMany({
          where,
          include: { uploader: { select: { id: true, full_name: true, avatar_url: true } } },
          orderBy: { created_at: 'desc' },
          skip: (page - 1) * PAGE_SIZES.assets,
          take: PAGE_SIZES.assets,
        }),
        prisma.asset.count({ where }),
      ])
      return reply.send({ data: items, meta: { total, page, totalPages: Math.ceil(total / PAGE_SIZES.assets) } })
    } catch (err) {
      fastify.log.error({ err }, '[assets] list gagal')
      return reply.status(500).send({ error: 'Terjadi kesalahan server' })
    }
  })

  fastify.post('/', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const parsed = assetUploadSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.issues[0]?.message ?? 'Data tidak valid' })
    }
    try {
      const asset = await prisma.asset.create({
        data: {
          ...parsed.data,
          uploaded_by: request.currentUser.id,
          watermark_status: parsed.data.watermarked_url ? 'done' : 'pending',
        },
      })
      return reply.status(201).send({ asset })
    } catch (err) {
      fastify.log.error({ err }, '[assets] create gagal')
      return reply.status(500).send({ error: 'Terjadi kesalahan server' })
    }
  })

  fastify.patch('/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const parsed = assetUpdateSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.issues[0]?.message ?? 'Data tidak valid' })
    }
    try {
      const existing = await prisma.asset.findUnique({ where: { id }, select: { uploaded_by: true } })
      if (!existing) return reply.status(404).send({ error: 'Aset tidak ditemukan' })
      const canEdit = existing.uploaded_by === request.currentUser.id ||
        (PENGURUS_OR_ABOVE as readonly string[]).includes(request.currentUser.role)
      if (!canEdit) return reply.status(403).send({ error: 'Akses ditolak' })
      const asset = await prisma.asset.update({ where: { id }, data: parsed.data })
      return reply.send({ asset })
    } catch (err) {
      fastify.log.error({ err }, '[assets] update gagal')
      return reply.status(500).send({ error: 'Terjadi kesalahan server' })
    }
  })

  fastify.delete('/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    try {
      const existing = await prisma.asset.findUnique({ where: { id }, select: { uploaded_by: true } })
      if (!existing) return reply.status(404).send({ error: 'Aset tidak ditemukan' })
      const canDelete = existing.uploaded_by === request.currentUser.id ||
        (ADMIN_OR_KETUA as readonly string[]).includes(request.currentUser.role)
      if (!canDelete) return reply.status(403).send({ error: 'Akses ditolak' })
      await prisma.asset.delete({ where: { id } })
      return reply.send({ ok: true })
    } catch (err) {
      fastify.log.error({ err }, '[assets] delete gagal')
      return reply.status(500).send({ error: 'Terjadi kesalahan server' })
    }
  })
}
