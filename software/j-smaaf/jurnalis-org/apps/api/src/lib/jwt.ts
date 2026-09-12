import jwt from 'jsonwebtoken'
import crypto from 'crypto'

export type AccessPayload = { sub: string; role: string }

export function signAccessToken(payload: AccessPayload): string {
  return jwt.sign(payload, process.env.JWT_ACCESS_SECRET!, {
    expiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? '15m',
  } as jwt.SignOptions)
}

export function verifyAccessToken(token: string): AccessPayload {
  return jwt.verify(token, process.env.JWT_ACCESS_SECRET!) as AccessPayload
}

export function generateRefreshToken(): { plain: string; hash: string } {
  const plain = crypto.randomBytes(48).toString('hex')
  const hash = crypto.createHash('sha256').update(plain).digest('hex')
  return { plain, hash }
}

export function hashRefreshToken(plain: string): string {
  return crypto.createHash('sha256').update(plain).digest('hex')
}
