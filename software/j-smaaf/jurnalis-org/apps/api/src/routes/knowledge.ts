import type { FastifyInstance } from 'fastify'
import { prisma } from '../lib/prisma'
import { knowledgeFormSchema, faqFormSchema, contactFormSchema } from '@jurnalis-org/shared/validations/notifications'
import { ADMIN_OR_KETUA } from '@jurnalis-org/shared/constants'
import { sendEmail } from '../lib/email'

export default async function knowledgeRoutes(fastify: FastifyInstance) {
  fastify.get('/knowledge', { preHandler: [fastify.authenticate] }, async (_request, reply) => {
    try {
      const docs = await prisma.knowledgeBase.findMany({ orderBy: [{ category: 'asc' }, { order_index: 'asc' }] })
      return reply.send({ data: docs })
    } catch (err) {
      fastify.log.error({ err }, '[knowledge] list gagal')
      return reply.status(500).send({ error: 'Terjadi kesalahan server' })
    }
  })

  fastify.post('/knowledge', { preHandler: [fastify.authenticate, fastify.requireRole(ADMIN_OR_KETUA)] }, async (request, reply) => {
    const parsed = knowledgeFormSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.issues[0]?.message ?? 'Data tidak valid' })
    }
    try {
      const doc = await prisma.knowledgeBase.create({
        data: { ...parsed.data, author_id: request.currentUser.id },
      })
      return reply.status(201).send({ doc })
    } catch (err) {
      fastify.log.error({ err }, '[knowledge] create gagal')
      return reply.status(500).send({ error: 'Terjadi kesalahan server' })
    }
  })

  fastify.patch('/knowledge/:id', { preHandler: [fastify.authenticate, fastify.requireRole(ADMIN_OR_KETUA)] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const parsed = knowledgeFormSchema.partial().safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.issues[0]?.message ?? 'Data tidak valid' })
    }
    try {
      const doc = await prisma.knowledgeBase.update({ where: { id }, data: parsed.data })
      return reply.send({ doc })
    } catch (err) {
      fastify.log.error({ err }, '[knowledge] update gagal')
      return reply.status(500).send({ error: 'Terjadi kesalahan server' })
    }
  })

  fastify.delete('/knowledge/:id', { preHandler: [fastify.authenticate, fastify.requireRole(ADMIN_OR_KETUA)] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    try {
      await prisma.knowledgeBase.delete({ where: { id } })
      return reply.send({ ok: true })
    } catch (err) {
      fastify.log.error({ err }, '[knowledge] delete gagal')
      return reply.status(500).send({ error: 'Terjadi kesalahan server' })
    }
  })

  fastify.post('/faqs', { preHandler: [fastify.authenticate, fastify.requireRole(ADMIN_OR_KETUA)] }, async (request, reply) => {
    const parsed = faqFormSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.issues[0]?.message ?? 'Data tidak valid' })
    }
    try {
      const faq = await prisma.faq.create({ data: parsed.data })
      return reply.status(201).send({ faq })
    } catch (err) {
      fastify.log.error({ err }, '[faqs] create gagal')
      return reply.status(500).send({ error: 'Terjadi kesalahan server' })
    }
  })

  fastify.delete('/faqs/:id', { preHandler: [fastify.authenticate, fastify.requireRole(ADMIN_OR_KETUA)] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    try {
      await prisma.faq.delete({ where: { id } })
      return reply.send({ ok: true })
    } catch (err) {
      fastify.log.error({ err }, '[faqs] delete gagal')
      return reply.status(500).send({ error: 'Terjadi kesalahan server' })
    }
  })

  fastify.post('/contact', async (request, reply) => {
    const parsed = contactFormSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.issues[0]?.message ?? 'Data tidak valid' })
    }
    try {
      const org = await prisma.orgProfile.findFirst({ select: { contact_email: true } })
      const to = org?.contact_email
      if (to) {
        await sendEmail(
          to,
          `[Kontak] ${parsed.data.subject}`,
          `<p><b>Dari:</b> ${parsed.data.name} (${parsed.data.email})</p><p>${parsed.data.message}</p>`,
        )
      }
      return reply.send({ ok: true })
    } catch (err) {
      fastify.log.error({ err }, '[contact] gagal')
      return reply.status(500).send({ error: 'Terjadi kesalahan server' })
    }
  })
}
