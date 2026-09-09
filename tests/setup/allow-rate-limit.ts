import './server-only'
import { createRequire } from 'node:module'

// Explicit fixture for tests of tool behavior, not of request security.
const loadModule = createRequire(`${process.cwd()}/package.json`)
const modulePath = loadModule.resolve('./lib/rate-limit')
const realExports = loadModule(modulePath)
loadModule.cache[modulePath]!.exports = { ...realExports, checkRateLimit: async () => ({ success: true }) }
