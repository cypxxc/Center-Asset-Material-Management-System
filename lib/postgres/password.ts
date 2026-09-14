import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'
const scrypt = promisify(scryptCallback)
export async function hashPassword(password: string) {
  if (password.length < 6 || password.length > 1024) throw new Error('Password must contain 6–1024 characters')
  const salt = randomBytes(32).toString('hex')
  const derived = await scrypt(password, salt, 64) as Buffer
  return `scrypt:${salt}:${derived.toString('hex')}`
}
export async function verifyPassword(password: string, encoded: string) {
  const [algorithm, salt, hash, extra] = encoded.split(':')
  if (extra !== undefined || algorithm !== 'scrypt' || !/^[a-f0-9]{64}$/.test(salt ?? '') || !/^[a-f0-9]{128}$/.test(hash ?? '') || password.length < 6 || password.length > 1024) return false
  const actual = await scrypt(password, salt, 64) as Buffer
  return timingSafeEqual(Buffer.from(hash, 'hex'), actual)
}
