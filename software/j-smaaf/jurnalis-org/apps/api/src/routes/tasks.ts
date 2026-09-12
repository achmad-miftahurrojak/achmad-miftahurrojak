import type { FastifyInstance } from 'fastify'
import { prisma } from '../lib/prisma'
import { taskCreateSchema, taskSubmitSchema, taskStatusUpdateSchema, taskCommentSchema } from '@jurnalis-org/shared/validations/tasks'
import { TASK_WEIGHTS, PENGURUS_OR_ABOVE, ADMIN_OR_KETUA, PAGE_SIZES } from '@jurnalis-org/shared/constants'
import { sendTaskAssigned, sendTaskStatusChange } from '../lib/notifications'

export default async function taskRoutes(fastify: FastifyInstance) {
  fastify.get('/', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const query = request.query as { page?: string; status?: string }
    const page = Math.max(1, Number(query.page ?? 1))
    const where: Record<string, unknown> = {}
    if (request.currentUser.role === 'anggota') {
      where.assigned_to = request.currentUser.id
    }
    if (query.status) where.status = query.status
    try {
      const [tasks, total] = await Promise.all([
        prisma.task.findMany({
          where,
          include: {
            assignee: { select: { id: true, full_name: true, avatar_url: true } },
            project: { select: { id: true, title: true } },
          },
          orderBy: [{ due_date: { sort: 'asc', nulls: 'last' } }],
          skip: (page - 1) * PAGE_SIZES.tasks,
          take: PAGE_SIZES.tasks,
        }),
        prisma.task.count({ where }),
      ])
      return reply.send({ data: tasks, meta: { total, page, totalPages: Math.ceil(total / PAGE_SIZES.tasks) } })
    } catch (err) {
      fastify.log.error({ err }, '[tasks] list gagal')
      return reply.status(500).send({ error: 'Terjadi kesalahan server' })
    }
  })

  fastify.get('/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    try {
      const task = await prisma.task.findUnique({
        where: { id },
        include: {
          assignee: { select: { id: true, full_name: true, avatar_url: true } },
          assigner: { select: { id: true, full_name: true } },
          project: { select: { id: true, title: true } },
          comments: {
            include: { author: { select: { id: true, full_name: true, avatar_url: true } } },
            orderBy: { created_at: 'asc' },
          },
          history: {
            include: { actor: { select: { id: true, full_name: true } } },
            orderBy: { created_at: 'desc' },
          },
        },
      })
      if (!task) return reply.status(404).send({ error: 'Tugas tidak ditemukan' })
      const isParticipant =
        task.assigned_to === request.currentUser.id ||
        task.assigned_by === request.currentUser.id ||
        (PENGURUS_OR_ABOVE as readonly string[]).includes(request.currentUser.role)
      if (!isParticipant) return reply.status(403).send({ error: 'Akses ditolak' })
      return reply.send({ task })
    } catch (err) {
      fastify.log.error({ err }, '[tasks] detail gagal')
      return reply.status(500).send({ error: 'Terjadi kesalahan server' })
    }
  })

  fastify.post('/', { preHandler: [fastify.authenticate, fastify.requireRole(PENGURUS_OR_ABOVE)] }, async (request, reply) => {
    const parsed = taskCreateSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.issues[0]?.message ?? 'Data tidak valid' })
    }
    const input = parsed.data
    try {
      const task = await prisma.task.create({
        data: {
          title: input.title,
          description: input.description,
          type: input.type,
          assigned_to: input.assigned_to,
          assigned_by: request.currentUser.id,
          project_id: input.project_id,
          due_date: input.due_date ? new Date(input.due_date) : null,
          estimated_hours: input.estimated_hours,
          weight: input.weight ?? TASK_WEIGHTS[input.type] ?? 5,
        },
      })
      await prisma.taskHistory.create({
        data: {
          task_id: task.id,
          actor_id: request.currentUser.id,
          action: 'assign',
          to_value: 'pending',
          notes: 'Tugas dibuat',
        },
      })
      if (input.assigned_to) {
        await sendTaskAssigned(fastify, {
          recipientId: input.assigned_to,
          taskTitle: task.title,
          taskId: task.id,
          dueDate: task.due_date?.toLocaleDateString('id-ID') ?? null,
        })
      }
      return reply.status(201).send({ task })
    } catch (err) {
      fastify.log.error({ err }, '[tasks] create gagal')
      return reply.status(500).send({ error: 'Terjadi kesalahan server' })
    }
  })

  fastify.post('/:id/submit', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const parsed = taskSubmitSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.issues[0]?.message ?? 'Data tidak valid' })
    }
    try {
      const task = await prisma.task.findUnique({ where: { id } })
      if (!task) return reply.status(404).send({ error: 'Tugas tidak ditemukan' })
      if (task.assigned_to !== request.currentUser.id) {
        return reply.status(403).send({ error: 'Hanya assignee yang bisa submit' })
      }
      if (!['pending', 'in_progress', 'revision'].includes(task.status)) {
        return reply.status(400).send({ error: 'Tugas tidak dalam status yang bisa disubmit' })
      }
      const updated = await prisma.task.update({
        where: { id },
        data: {
          status: 'review',
          notes: parsed.data.notes ?? task.notes,
          attachments: parsed.data.attachments as never,
        },
      })
      await prisma.taskHistory.create({
        data: {
          task_id: id,
          actor_id: request.currentUser.id,
          action: 'submit',
          from_value: task.status,
          to_value: 'review',
          notes: parsed.data.notes,
        },
      })
      if (task.assigned_by) {
        await sendTaskStatusChange(fastify, {
          recipientId: task.assigned_by,
          taskTitle: task.title,
          taskId: id,
          newStatus: 'review',
        })
      }
      return reply.send({ task: updated })
    } catch (err) {
      fastify.log.error({ err }, '[tasks] submit gagal')
      return reply.status(500).send({ error: 'Terjadi kesalahan server' })
    }
  })

  fastify.patch('/:id/status', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const parsed = taskStatusUpdateSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.issues[0]?.message ?? 'Data tidak valid' })
    }
    const { status, notes } = parsed.data
    try {
      const task = await prisma.task.findUnique({ where: { id } })
      if (!task) return reply.status(404).send({ error: 'Tugas tidak ditemukan' })
      const isAssignee = task.assigned_to === request.currentUser.id
      const isManager = (PENGURUS_OR_ABOVE as readonly string[]).includes(request.currentUser.role)
      if (!isManager && !(isAssignee && status === 'in_progress')) {
        return reply.status(403).send({ error: 'Tidak berhak mengubah status tugas ini' })
      }
      const updated = await prisma.task.update({
        where: { id },
        data: {
          status,
          completed_at: status === 'completed' ? new Date() : null,
        },
      })
      await prisma.taskHistory.create({
        data: {
          task_id: id,
          actor_id: request.currentUser.id,
          action: 'status_change',
          from_value: task.status,
          to_value: status,
          notes,
        },
      })
      if (status === 'completed') {
        await prisma.analyticsEvent.create({
          data: {
            event_type: 'task_completed',
            entity_type: 'task',
            entity_id: id,
            actor_id: request.currentUser.id,
            metadata: { weight: task.weight, on_time: !task.due_date || new Date() <= task.due_date } as never,
          },
        })
      }
      const notifyTargets = new Set<string>()
      if (task.assigned_to && task.assigned_to !== request.currentUser.id) notifyTargets.add(task.assigned_to)
      if (task.assigned_by && task.assigned_by !== request.currentUser.id) notifyTargets.add(task.assigned_by)
      for (const target of notifyTargets) {
        await sendTaskStatusChange(fastify, {
          recipientId: target,
          taskTitle: task.title,
          taskId: id,
          newStatus: status,
        })
      }
      return reply.send({ task: updated })
    } catch (err) {
      fastify.log.error({ err }, '[tasks] update status gagal')
      return reply.status(500).send({ error: 'Terjadi kesalahan server' })
    }
  })

  fastify.post('/:id/comments', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const parsed = taskCommentSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.issues[0]?.message ?? 'Data tidak valid' })
    }
    try {
      const task = await prisma.task.findUnique({ where: { id }, select: { id: true, assigned_to: true, assigned_by: true } })
      if (!task) return reply.status(404).send({ error: 'Tugas tidak ditemukan' })
      const comment = await prisma.taskComment.create({
        data: { task_id: id, author_id: request.currentUser.id, content: parsed.data.content },
        include: { author: { select: { id: true, full_name: true, avatar_url: true } } },
      })
      await prisma.taskHistory.create({
        data: { task_id: id, actor_id: request.currentUser.id, action: 'comment' },
      })
      return reply.status(201).send({ comment })
    } catch (err) {
      fastify.log.error({ err }, '[tasks] comment gagal')
      return reply.status(500).send({ error: 'Terjadi kesalahan server' })
    }
  })

  fastify.delete('/:id', { preHandler: [fastify.authenticate, fastify.requireRole(ADMIN_OR_KETUA)] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    try {
      await prisma.task.delete({ where: { id } })
      return reply.send({ ok: true })
    } catch (err) {
      fastify.log.error({ err }, '[tasks] delete gagal')
      return reply.status(500).send({ error: 'Terjadi kesalahan server' })
    }
  })
}
