import { createRequire } from 'node:module'
const load = createRequire(`${process.cwd()}/package.json`)
const modulePath = load.resolve('server-only')
load.cache[modulePath] = { id: modulePath, filename: modulePath, loaded: true, exports: {} } as NodeJS.Module
