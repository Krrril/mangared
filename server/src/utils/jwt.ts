import jwt from 'jsonwebtoken'

const secret = process.env.JWT_SECRET
if (!secret) {
  throw new Error('JWT_SECRET is not set — проверь server/.env (см. .env.example)')
}
const JWT_SECRET: string = secret

const EXPIRES_IN = '30d'

export interface AppJwtPayload {
  userId: string
}

export function signToken(payload: AppJwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: EXPIRES_IN })
}

export function verifyToken(token: string): AppJwtPayload {
  const decoded = jwt.verify(token, JWT_SECRET)
  if (typeof decoded === 'string' || typeof decoded.userId !== 'string') {
    throw new Error('Невалидный токен')
  }
  return { userId: decoded.userId }
}
