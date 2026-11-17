// Unit tests run outside React's server condition; this marks the boundary without replacing tool logic.
const filename = require.resolve('server-only')
require.cache[filename] = { id: filename, filename, loaded: true, exports: {} } as NodeJS.Module
