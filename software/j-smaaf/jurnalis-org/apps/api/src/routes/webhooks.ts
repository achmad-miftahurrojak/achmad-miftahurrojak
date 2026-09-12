import type { FastifyInstance } from 'fastify'
import crypto from 'crypto'

export default async function webhookRoutes(fastify: FastifyInstance) {
  // Verifikasi webhook Meta WhatsApp (GET challenge)
  fastify.get('/wa-cloud', async (request, reply) => {
    const query = request.query as { 'hub.mode'?: string; 'hub.verify_token'?: string; 'hub.challenge'?: string }
    if (
      query['hub.mode'] === 'subscribe' &&
      query['hub.verify_token'] === process.env.META_WA_WEBHOOK_VERIFY_TOKEN
    ) {
      return reply.status(200).type('text/plain').send(query['hub.challenge'] ?? '')
    }
    return reply.status(403).send({ error: 'Verifikasi gagal' })
  })

  // Event masuk dari WhatsApp — verifikasi signature SEBELUM proses payload (RULE-012)
  fastify.post('/wa-cloud', { config: { rawBody: true } }, async (request, reply) => {
    const appSecret = process.env.META_WA_APP_SECRET
    const signature = request.headers['x-hub-signature-256'] as string | undefined
    if (appSecret && signature) {
      const expected = `sha256=${crypto.createHmac('sha256', appSecret).update(request.rawBody ?? '').digest('hex')}`
      const a = Buffer.from(signature)
      const b = Buffer.from(expected)
      if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
        return reply.status(401).send({ error: 'Signature tidak valid' })
      }
    }
    try {
      const body = request.body as { entry?: unknown[] }
      fastify.log.info({ entries: body.entry?.length ?? 0 }, '[webhook] WA event diterima')
      // Status delivery notification diproses di sini bila diperlukan
    } catch (err) {
      fastify.log.error({ err }, '[webhook] gagal proses WA event')
    }
    return reply.send({ ok: true })
  })
}
