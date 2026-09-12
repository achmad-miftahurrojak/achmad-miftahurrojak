import fp from 'fastify-plugin'
import websocket from '@fastify/websocket'
import type { FastifyInstance } from 'fastify'
import type { WebSocket } from 'ws'
import { verifyAccessToken } from '../lib/jwt'

declare module 'fastify' {
  interface FastifyInstance {
    pushToUser: (userId: string, event: string, payload: unknown) => void
  }
}

const connections = new Map<string, Set<WebSocket>>()

export default fp(async function websocketPlugin(fastify: FastifyInstance) {
  await fastify.register(websocket)

  fastify.decorate('pushToUser', function (userId: string, event: string, payload: unknown) {
    const sockets = connections.get(userId)
    if (!sockets) return
    const message = JSON.stringify({ event, payload })
    for (const socket of sockets) {
      if (socket.readyState === socket.OPEN) {
        socket.send(message)
      }
    }
  })

  fastify.get('/ws', { websocket: true }, (socket, request) => {
    // Wajib: verifikasi JWT cookie SEBELUM menerima koneksi
    const token = request.cookies.access_token
    let userId: string | null = null
    if (token) {
      try {
        const payload = verifyAccessToken(token)
        userId = payload.sub
      } catch {
        userId = null
      }
    }
    if (!userId) {
      socket.close(4001, 'Unauthorized')
      return
    }

    const uid = userId
    if (!connections.has(uid)) connections.set(uid, new Set())
    connections.get(uid)!.add(socket)

    socket.on('close', () => {
      const set = connections.get(uid)
      if (set) {
        set.delete(socket)
        if (set.size === 0) connections.delete(uid)
      }
    })

    socket.on('message', () => {
      // Client tidak perlu kirim pesan; koneksi hanya untuk push dari server
    })
  })
})
