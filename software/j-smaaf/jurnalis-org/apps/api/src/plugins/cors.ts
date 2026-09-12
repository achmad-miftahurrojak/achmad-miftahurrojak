import fp from 'fastify-plugin'
import cors from '@fastify/cors'
import type { FastifyInstance } from 'fastify'

export default fp(async function corsPlugin(fastify: FastifyInstance) {
  await fastify.register(cors, {
    origin: [process.env.FRONTEND_URL ?? 'http://localhost:3000'],
    credentials: true,
  })
})
