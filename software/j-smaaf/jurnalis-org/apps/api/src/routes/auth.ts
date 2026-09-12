import type { FastifyInstance, FastifyReply } from 'fastify'
import crypto from 'crypto'
import { prisma } from '../lib/prisma'
import { hashPassword, verifyPassword } from '../lib/password'
import { signAccessToken, generateRefreshToken, hashRefreshToken } from '../lib/jwt'
import { sendEmail } from '../lib/email'
import {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  updateProfileSchema,
} from '@jurnalis-org/shared/validations/auth'

const isProd = process.env.NODE_ENV === 'production'
const ACCESS_COOKIE_OPTS = { path: '/', httpOnly: true, sameSite: 'lax' as const, secure: isProd }
const REFRESH_COOKIE_OPTS = { path: '/api/auth', httpOnly: true, sameSite: 'lax' as const, secure: isProd }

const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000

async function issueTokens(fastify: FastifyInstance, reply: FastifyReply, user: { id: string; role: string }) {
  const accessToken = signAccessToken({ sub: user.id, role: user.role })
  const { plain, hash } = generateRefreshToken()
  try {
    await prisma.refreshToken.create({
      data: { user_id: user.id, token_hash: hash, expires_at: new Date(Date.now() + REFRESH_TTL_MS) },
    })
  } catch (err) {
    fastify.log.error({ err }, '[auth] gagal menyimpan refresh token')
    throw err
  }
  reply.setCookie('access_token', accessToken, { ...ACCESS_COOKIE_OPTS, maxAge: 15 * 60 })
  reply.setCookie('refresh_token', plain, { ...REFRESH_COOKIE_OPTS, maxAge: 30 * 24 * 60 * 60 })
}

export default async function authRoutes(fastify: FastifyInstance) {
  fastify.post('/register', async (request, reply) => {
    const parsed = registerSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.issues[0]?.message ?? 'Data tidak valid' })
    }
    const input = parsed.data
    try {
      const existing = await prisma.user.findUnique({ where: { email: input.email } })
      if (existing) {
        return reply.status(409).send({ error: 'Email sudah terdaftar' })
      }
      const user = await prisma.user.create({
        data: {
          full_name: input.full_name,
          nickname: input.nickname,
          email: input.email,
          password_hash: await hashPassword(input.password),
          phone: input.phone || null,
          angkatan: input.angkatan,
          division: input.division,
        },
      })
      await issueTokens(fastify, reply, user)
      return reply.status(201).send({
        user: { id: user.id, full_name: user.full_name, email: user.email, role: user.role },
      })
    } catch (err) {
      fastify.log.error({ err }, '[auth] register gagal')
      return reply.status(500).send({ error: 'Terjadi kesalahan server' })
    }
  })

  fastify.post('/login', async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Email dan password wajib diisi' })
    }
    const { email, password } = parsed.data
    try {
      const user = await prisma.user.findUnique({ where: { email } })
      if (!user || !(await verifyPassword(user.password_hash, password))) {
        return reply.status(401).send({ error: 'Email atau password salah' })
      }
      if (!user.is_active) {
        return reply.status(403).send({ error: 'Akun dinonaktifkan' })
      }
      await issueTokens(fastify, reply, user)
      return reply.send({
        user: { id: user.id, full_name: user.full_name, email: user.email, role: user.role },
      })
    } catch (err) {
      fastify.log.error({ err }, '[auth] login gagal')
      return reply.status(500).send({ error: 'Terjadi kesalahan server' })
    }
  })

  fastify.post('/refresh', async (request, reply) => {
    const plain = request.cookies.refresh_token
    if (!plain) {
      return reply.status(401).send({ error: 'Refresh token tidak ditemukan' })
    }
    const hash = hashRefreshToken(plain)
    try {
      const stored = await prisma.refreshToken.findUnique({
        where: { token_hash: hash },
        include: { user: true },
      })
      if (!stored || stored.revoked_at || stored.expires_at < new Date()) {
        return reply.status(401).send({ error: 'Refresh token tidak valid' })
      }
      // Rotasi: revoke token lama, terbitkan token baru (RULE-013)
      await prisma.refreshToken.update({
        where: { id: stored.id },
        data: { revoked_at: new Date() },
      })
      await issueTokens(fastify, reply, stored.user)
      return reply.send({ ok: true })
    } catch (err) {
      fastify.log.error({ err }, '[auth] refresh gagal')
      return reply.status(500).send({ error: 'Terjadi kesalahan server' })
    }
  })

  fastify.post('/logout', async (request, reply) => {
    const plain = request.cookies.refresh_token
    if (plain) {
      try {
        await prisma.refreshToken.updateMany({
          where: { token_hash: hashRefreshToken(plain), revoked_at: null },
          data: { revoked_at: new Date() },
        })
      } catch (err) {
        fastify.log.error({ err }, '[auth] logout: gagal revoke token')
      }
    }
    reply.clearCookie('access_token', ACCESS_COOKIE_OPTS)
    reply.clearCookie('refresh_token', REFRESH_COOKIE_OPTS)
    return reply.send({ ok: true })
  })

  fastify.post('/forgot-password', async (request, reply) => {
    const parsed = forgotPasswordSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Email tidak valid' })
    }
    // Selalu 200 agar tidak bocor info email terdaftar atau tidak
    try {
      const user = await prisma.user.findUnique({ where: { email: parsed.data.email } })
      if (user) {
        const token = crypto.randomBytes(32).toString('hex')
        const tokenHash = crypto.createHash('sha256').update(token).digest('hex')
        await prisma.passwordResetToken.create({
          data: { user_id: user.id, token_hash: tokenHash, expires_at: new Date(Date.now() + 60 * 60 * 1000) },
        })
        const link = `${process.env.FRONTEND_URL ?? 'http://localhost:3000'}/reset-password?token=${token}`
        await sendEmail(
          user.email,
          'Reset Password Jurnalis Org',
          `<p>Klik link berikut untuk mereset password (berlaku 1 jam):</p><p><a href="${link}">${link}</a></p>`,
        )
      }
    } catch (err) {
      fastify.log.error({ err }, '[auth] forgot-password gagal')
    }
    return reply.send({ ok: true })
  })

  fastify.post('/reset-password', async (request, reply) => {
    const parsed = resetPasswordSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.issues[0]?.message ?? 'Data tidak valid' })
    }
    const tokenHash = crypto.createHash('sha256').update(parsed.data.token).digest('hex')
    try {
      const stored = await prisma.passwordResetToken.findUnique({ where: { token_hash: tokenHash } })
      if (!stored || stored.used_at || stored.expires_at < new Date()) {
        return reply.status(400).send({ error: 'Token tidak valid atau kedaluwarsa' })
      }
      await prisma.$transaction([
        prisma.user.update({
          where: { id: stored.user_id },
          data: { password_hash: await hashPassword(parsed.data.password) },
        }),
        prisma.passwordResetToken.update({ where: { id: stored.id }, data: { used_at: new Date() } }),
        prisma.refreshToken.updateMany({
          where: { user_id: stored.user_id, revoked_at: null },
          data: { revoked_at: new Date() },
        }),
      ])
      return reply.send({ ok: true })
    } catch (err) {
      fastify.log.error({ err }, '[auth] reset-password gagal')
      return reply.status(500).send({ error: 'Terjadi kesalahan server' })
    }
  })

  fastify.get('/me', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    try {
      const user = await prisma.user.findUnique({
        where: { id: request.currentUser.id },
        select: {
          id: true, full_name: true, nickname: true, email: true, phone: true,
          avatar_url: true, role: true, division: true, angkatan: true,
          graduation_year: true, bio: true, is_active: true,
          email_notifications: true, wa_notifications: true, created_at: true,
        },
      })
      if (!user) return reply.status(404).send({ error: 'User tidak ditemukan' })
      return reply.send({ user })
    } catch (err) {
      fastify.log.error({ err }, '[auth] me gagal')
      return reply.status(500).send({ error: 'Terjadi kesalahan server' })
    }
  })

  fastify.patch('/me', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const parsed = updateProfileSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.issues[0]?.message ?? 'Data tidak valid' })
    }
    try {
      const user = await prisma.user.update({
        where: { id: request.currentUser.id },
        data: parsed.data,
        select: {
          id: true, full_name: true, nickname: true, email: true, phone: true,
          avatar_url: true, role: true, division: true, angkatan: true, bio: true,
          email_notifications: true, wa_notifications: true,
        },
      })
      return reply.send({ user })
    } catch (err) {
      fastify.log.error({ err }, '[auth] update profile gagal')
      return reply.status(500).send({ error: 'Terjadi kesalahan server' })
    }
  })
}
