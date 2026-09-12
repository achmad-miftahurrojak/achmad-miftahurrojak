import Fastify from 'fastify'
import cookie from '@fastify/cookie'
import rawBody from 'fastify-raw-body'
import corsPlugin from './plugins/cors'
import authPlugin from './plugins/auth'
import websocketPlugin from './plugins/websocket'
import authRoutes from './routes/auth'
import storageRoutes from './routes/storage'
import webhookRoutes from './routes/webhooks'
import cronRoutes from './routes/cron'
import taskRoutes from './routes/tasks'
import projectRoutes from './routes/projects'
import meetingRoutes from './routes/meetings'
import contentRoutes from './routes/content'
import financeRoutes from './routes/finance'
import notificationRoutes from './routes/notifications'
import knowledgeRoutes from './routes/knowledge'
import alumniRoutes from './routes/alumni'
import performanceRoutes from './routes/performance'
import pitchRoutes from './routes/pitches'
import assetRoutes from './routes/assets'
import analyticsRoutes from './routes/analytics'
import userRoutes from './routes/users'
import { prisma } from './lib/prisma'

const fastify = Fastify({
  logger: { level: process.env.NODE_ENV === 'production' ? 'info' : 'debug' },
})

async function main() {
  await fastify.register(cookie)
  await fastify.register(rawBody, { field: 'rawBody', global: false, encoding: 'utf8', runFirst: true })
  await fastify.register(corsPlugin)
  await fastify.register(authPlugin)
  await fastify.register(websocketPlugin)

  fastify.get('/health', async () => ({ status: 'ok', ts: new Date().toISOString() }))

  fastify.get('/health/db', async (_request, reply) => {
    try {
      await prisma.$queryRaw`SELECT 1`
      return reply.send({ status: 'ok', database: 'connected', ts: new Date().toISOString() })
    } catch (err) {
      fastify.log.error({ err }, '[health] database check gagal')
      return reply.status(503).send({ status: 'degraded', database: 'unavailable', ts: new Date().toISOString() })
    }
  })

  await fastify.register(authRoutes, { prefix: '/api/auth' })
  await fastify.register(storageRoutes, { prefix: '/api/storage' })
  await fastify.register(notificationRoutes, { prefix: '/api/notifications' })
  await fastify.register(webhookRoutes, { prefix: '/webhooks' })
  await fastify.register(cronRoutes, { prefix: '/cron' })
  await fastify.register(taskRoutes, { prefix: '/api/tasks' })
  await fastify.register(projectRoutes, { prefix: '/api/projects' })
  await fastify.register(meetingRoutes, { prefix: '/api/meetings' })
  await fastify.register(contentRoutes, { prefix: '/api/content' })
  await fastify.register(financeRoutes, { prefix: '/api/finance' })
  await fastify.register(knowledgeRoutes, { prefix: '/api' })
  await fastify.register(alumniRoutes, { prefix: '/api/alumni' })
  await fastify.register(performanceRoutes, { prefix: '/api/performance' })
  await fastify.register(pitchRoutes, { prefix: '/api/pitches' })
  await fastify.register(assetRoutes, { prefix: '/api/assets' })
  await fastify.register(analyticsRoutes, { prefix: '/api/analytics' })
  await fastify.register(userRoutes, { prefix: '/api/users' })

  const port = Number(process.env.PORT ?? 4000)
  await fastify.listen({ port, host: '0.0.0.0' })
}

main().catch((err) => {
  fastify.log.error(err)
  process.exit(1)
})
