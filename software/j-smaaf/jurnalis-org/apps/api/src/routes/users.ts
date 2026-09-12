import type { FastifyInstance } from 'fastify'
import { prisma } from '../lib/prisma'
import { adminUpdateUserSchema } from '@jurnalis-org/shared/validations/auth'
import { orgStructureSchema, achievementSchema, orgProfileSchema } from '@jurnalis-org/shared/validations/users'
import { ADMIN_OR_KETUA } from '@jurnalis-org/shared/constants'

export default async function userRoutes(fastify: FastifyInstance) {
  // Dropdown assign tugas / struktur
  fastify.get('/members', { preHandler: [fastify.authenticate] }, async (_request, reply) => {
    try {
      const members = await prisma.user.findMany({
        where: { is_active: true, role: { notIn: ['alumni'] } },
        select: { id: true, full_name: true, nickname: true, role: true, division: true, avatar_url: true },
        orderBy: { full_name: 'asc' },
      })
      return reply.send({ data: members })
    } catch (err) {
      fastify.log.error({ err }, '[users] members gagal')
      return reply.status(500).send({ error: 'Terjadi kesalahan server' })
    }
  })

  fastify.get('/', { preHandler: [fastify.authenticate, fastify.requireRole(ADMIN_OR_KETUA)] }, async (request, reply) => {
    const query = request.query as { q?: string; role?: string }
    const where: Record<string, unknown> = {}
    if (query.q) where.OR = [
      { full_name: { contains: query.q, mode: 'insensitive' } },
      { email: { contains: query.q, mode: 'insensitive' } },
    ]
    if (query.role) where.role = query.role
    try {
      const users = await prisma.user.findMany({
        where,
        select: {
          id: true, full_name: true, nickname: true, email: true, role: true,
          division: true, angkatan: true, is_active: true, avatar_url: true, created_at: true,
        },
        orderBy: { created_at: 'desc' },
        take: 100,
      })
      return reply.send({ data: users })
    } catch (err) {
      fastify.log.error({ err }, '[users] list gagal')
      return reply.status(500).send({ error: 'Terjadi kesalahan server' })
    }
  })

  fastify.patch('/:id', { preHandler: [fastify.authenticate, fastify.requireRole(ADMIN_OR_KETUA)] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const parsed = adminUpdateUserSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.issues[0]?.message ?? 'Data tidak valid' })
    }
    try {
      const user = await prisma.user.update({
        where: { id },
        data: parsed.data,
        select: { id: true, full_name: true, email: true, role: true, is_active: true },
      })
      return reply.send({ user })
    } catch (err) {
      fastify.log.error({ err }, '[users] update gagal')
      return reply.status(500).send({ error: 'Terjadi kesalahan server' })
    }
  })

  fastify.post('/org-structure', { preHandler: [fastify.authenticate, fastify.requireRole(ADMIN_OR_KETUA)] }, async (request, reply) => {
    const parsed = orgStructureSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.issues[0]?.message ?? 'Data tidak valid' })
    }
    try {
      const entry = await prisma.orgStructure.create({ data: parsed.data })
      return reply.status(201).send({ entry })
    } catch (err) {
      fastify.log.error({ err }, '[users] org-structure gagal')
      return reply.status(500).send({ error: 'Terjadi kesalahan server' })
    }
  })

  fastify.delete('/org-structure/:id', { preHandler: [fastify.authenticate, fastify.requireRole(ADMIN_OR_KETUA)] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    try {
      await prisma.orgStructure.delete({ where: { id } })
      return reply.send({ ok: true })
    } catch (err) {
      fastify.log.error({ err }, '[users] delete org-structure gagal')
      return reply.status(500).send({ error: 'Terjadi kesalahan server' })
    }
  })

  fastify.post('/achievements', { preHandler: [fastify.authenticate, fastify.requireRole(ADMIN_OR_KETUA)] }, async (request, reply) => {
    const parsed = achievementSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.issues[0]?.message ?? 'Data tidak valid' })
    }
    try {
      const achievement = await prisma.achievement.create({ data: parsed.data })
      return reply.status(201).send({ achievement })
    } catch (err) {
      fastify.log.error({ err }, '[users] achievement gagal')
      return reply.status(500).send({ error: 'Terjadi kesalahan server' })
    }
  })

  fastify.patch('/org-profile', { preHandler: [fastify.authenticate, fastify.requireRole(ADMIN_OR_KETUA)] }, async (request, reply) => {
    const parsed = orgProfileSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.issues[0]?.message ?? 'Data tidak valid' })
    }
    try {
      const existing = await prisma.orgProfile.findFirst()
      if (!existing) return reply.status(404).send({ error: 'Profil organisasi belum ada' })
      const org = await prisma.orgProfile.update({ where: { id: existing.id }, data: parsed.data })
      return reply.send({ org })
    } catch (err) {
      fastify.log.error({ err }, '[users] update org profile gagal')
      return reply.status(500).send({ error: 'Terjadi kesalahan server' })
    }
  })
}
