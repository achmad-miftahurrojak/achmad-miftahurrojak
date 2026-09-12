import fp from 'fastify-plugin'
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { verifyAccessToken } from '../lib/jwt'

export interface CurrentUser {
  id: string
  role: string
}

declare module 'fastify' {
  interface FastifyRequest {
    currentUser: CurrentUser
  }
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>
    requireRole: (roles: readonly string[]) => (request: FastifyRequest, reply: FastifyReply) => Promise<void>
  }
}

export default fp(async function authPlugin(fastify: FastifyInstance) {
  fastify.decorate('authenticate', async function (request: FastifyRequest, reply: FastifyReply) {
    const token = request.cookies.access_token
    if (!token) {
      return reply.status(401).send({ error: 'Tidak terautentikasi' })
    }
    try {
      const payload = verifyAccessToken(token)
      request.currentUser = { id: payload.sub, role: payload.role }
    } catch {
      return reply.status(401).send({ error: 'Token tidak valid atau kedaluwarsa' })
    }
  })

  fastify.decorate('requireRole', function (roles: readonly string[]) {
    return async function (request: FastifyRequest, reply: FastifyReply) {
      if (!request.currentUser) {
        return reply.status(401).send({ error: 'Tidak terautentikasi' })
      }
      if (!roles.includes(request.currentUser.role)) {
        return reply.status(403).send({ error: 'Akses ditolak' })
      }
    }
  })
})
