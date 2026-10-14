import { randomBytes, scrypt as scryptCallback, timingSafeEqual, type ScryptOptions } from 'node:crypto'

export const SCRYPT_CONFIG = {
  keylen: 64,
  cost: 16384,
  blockSize: 8,
  parallelization: 1,
} as const

function scryptAsync(password: string, salt: string, keylen: number, options: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCallback(password, salt, keylen, options, (err, derivedKey) => {
      if (err) reject(err)
      else resolve(derivedKey as Buffer)
    })
  })
}

export async function hashPassword(password: string) {
  if (password.length < 6 || password.length > 1024) throw new Error('Password must contain 6–1024 characters')
  const salt = randomBytes(32).toString('hex')
  const derived = await scryptAsync(password, salt, SCRYPT_CONFIG.keylen, {
    N: SCRYPT_CONFIG.cost,
    r: SCRYPT_CONFIG.blockSize,
    p: SCRYPT_CONFIG.parallelization,
  })
  return `scrypt:${salt}:${derived.toString('hex')}`
}
export async function verifyPassword(password: string, encoded: string) {
  const [algorithm, salt, hash, extra] = encoded.split(':')
  if (extra !== undefined || algorithm !== 'scrypt' || !/^[a-f0-9]{64}$/.test(salt ?? '') || !/^[a-f0-9]{128}$/.test(hash ?? '') || password.length < 6 || password.length > 1024) return false
  const actual = await scryptAsync(password, salt, SCRYPT_CONFIG.keylen, {
    N: SCRYPT_CONFIG.cost,
    r: SCRYPT_CONFIG.blockSize,
    p: SCRYPT_CONFIG.parallelization,
  })
  return timingSafeEqual(Buffer.from(hash, 'hex'), actual)
}

