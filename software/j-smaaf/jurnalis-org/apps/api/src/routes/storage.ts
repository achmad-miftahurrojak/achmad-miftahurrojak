import type { FastifyInstance } from 'fastify'
import { createUploadUrl, createDownloadUrl, deleteObject, listObjects, publicUrl, type LogicalBucket } from '../lib/storage'
import { signedUrlSchema, downloadUrlSchema } from '@jurnalis-org/shared/validations/storage'
import { PENGURUS_OR_ABOVE } from '@jurnalis-org/shared/constants'

export default async function storageRoutes(fastify: FastifyInstance) {
  fastify.post('/signed-url', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const parsed = signedUrlSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.issues[0]?.message ?? 'Data tidak valid' })
    }
    const { filename, contentType, bucket, folder } = parsed.data
    const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_')
    const path = `${folder}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}-${safeName}`
    try {
      const signedUrl = await createUploadUrl(bucket, path, contentType)
      return reply.send({ signedUrl, path, url: publicUrl(bucket, path), expiresIn: 3600 })
    } catch (err) {
      fastify.log.error({ err }, '[storage] signed-url gagal')
      return reply.status(500).send({ error: 'Gagal membuat URL upload' })
    }
  })

  fastify.post('/download-url', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const parsed = downloadUrlSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Data tidak valid' })
    }
    try {
      const signedUrl = await createDownloadUrl(parsed.data.bucket, parsed.data.path)
      return reply.send({ signedUrl, expiresIn: 3600 })
    } catch (err) {
      fastify.log.error({ err }, '[storage] download-url gagal')
      return reply.status(500).send({ error: 'Gagal membuat URL download' })
    }
  })

  fastify.get('/files', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const query = request.query as { bucket?: string; prefix?: string }
    const bucket: LogicalBucket = query.bucket === 'private' ? 'private' : 'public'
    try {
      const files = await listObjects(bucket, query.prefix ?? '')
      return reply.send({ files })
    } catch (err) {
      fastify.log.error({ err }, '[storage] list files gagal')
      return reply.status(500).send({ error: 'Gagal mengambil daftar file' })
    }
  })

  fastify.delete('/files', { preHandler: [fastify.authenticate, fastify.requireRole(PENGURUS_OR_ABOVE)] }, async (request, reply) => {
    const parsed = downloadUrlSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Data tidak valid' })
    }
    try {
      await deleteObject(parsed.data.bucket, parsed.data.path)
      return reply.send({ ok: true })
    } catch (err) {
      fastify.log.error({ err }, '[storage] delete file gagal')
      return reply.status(500).send({ error: 'Gagal menghapus file' })
    }
  })
}
