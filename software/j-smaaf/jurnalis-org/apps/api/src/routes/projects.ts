import type { FastifyInstance } from 'fastify'
import { prisma } from '../lib/prisma'
import { projectFormSchema } from '@jurnalis-org/shared/validations/projects'
import { PENGURUS_OR_ABOVE, PAGE_SIZES } from '@jurnalis-org/shared/constants'

function computeProgress(tasks: { weight: number; status: string }[]): number {
  const totalWeight = tasks.reduce((sum, t) => sum + t.weight, 0)
  if (totalWeight === 0) return 0
  const completedWeight = tasks.filter((t) => t.status === 'completed').reduce((sum, t) => sum + t.weight, 0)
  return Math.round((completedWeight / totalWeight) * 100)
}

export default async function projectRoutes(fastify: FastifyInstance) {
  fastify.get('/', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const query = request.query as { page?: string }
    const page = Math.max(1, Number(query.page ?? 1))
    try {
      const [projects, total] = await Promise.all([
        prisma.project.findMany({
          include: {
            coordinator: { select: { id: true, full_name: true, avatar_url: true } },
            tasks: { select: { weight: true, status: true } },
          },
          orderBy: { created_at: 'desc' },
          skip: (page - 1) * PAGE_SIZES.projects,
          take: PAGE_SIZES.projects,
        }),
        prisma.project.count(),
      ])
      const data = projects.map((p) => ({
        ...p,
        tasks: undefined,
        task_count: p.tasks.length,
        progress: computeProgress(p.tasks),
      }))
      return reply.send({ data, meta: { total, page, totalPages: Math.ceil(total / PAGE_SIZES.projects) } })
    } catch (err) {
      fastify.log.error({ err }, '[projects] list gagal')
      return reply.status(500).send({ error: 'Terjadi kesalahan server' })
    }
  })

  fastify.get('/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    try {
      const project = await prisma.project.findUnique({
        where: { id },
        include: {
          coordinator: { select: { id: true, full_name: true, avatar_url: true } },
          tasks: {
            include: { assignee: { select: { id: true, full_name: true, avatar_url: true } } },
            orderBy: [{ due_date: { sort: 'asc', nulls: 'last' } }],
          },
        },
      })
      if (!project) return reply.status(404).send({ error: 'Proyek tidak ditemukan' })
      return reply.send({ project: { ...project, progress: computeProgress(project.tasks) } })
    } catch (err) {
      fastify.log.error({ err }, '[projects] detail gagal')
      return reply.status(500).send({ error: 'Terjadi kesalahan server' })
    }
  })

  fastify.post('/', { preHandler: [fastify.authenticate, fastify.requireRole(PENGURUS_OR_ABOVE)] }, async (request, reply) => {
    const parsed = projectFormSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.issues[0]?.message ?? 'Data tidak valid' })
    }
    const input = parsed.data
    try {
      const project = await prisma.project.create({
        data: {
          title: input.title,
          description: input.description,
          category: input.category,
          status: input.status,
          coordinator_id: input.coordinator_id ?? request.currentUser.id,
          start_date: input.start_date ? new Date(input.start_date) : null,
          end_date: input.end_date ? new Date(input.end_date) : null,
          estimated_hours: input.estimated_hours,
          cover_image: input.cover_image,
        },
      })
      return reply.status(201).send({ project })
    } catch (err) {
      fastify.log.error({ err }, '[projects] create gagal')
      return reply.status(500).send({ error: 'Terjadi kesalahan server' })
    }
  })

  fastify.patch('/:id', { preHandler: [fastify.authenticate, fastify.requireRole(PENGURUS_OR_ABOVE)] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const parsed = projectFormSchema.partial().safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.issues[0]?.message ?? 'Data tidak valid' })
    }
    try {
      const project = await prisma.project.update({ where: { id }, data: parsed.data })
      return reply.send({ project })
    } catch (err) {
      fastify.log.error({ err }, '[projects] update gagal')
      return reply.status(500).send({ error: 'Terjadi kesalahan server' })
    }
  })

  fastify.delete('/:id', { preHandler: [fastify.authenticate, fastify.requireRole(['admin', 'ketua'])] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    try {
      await prisma.project.delete({ where: { id } })
      return reply.send({ ok: true })
    } catch (err) {
      fastify.log.error({ err }, '[projects] delete gagal')
      return reply.status(500).send({ error: 'Terjadi kesalahan server' })
    }
  })
}
