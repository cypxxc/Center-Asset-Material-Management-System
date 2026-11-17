// Resolve uploads before Next's standalone server changes the working directory.
// Keep dev, production, and backup scripts pointed at the same persistent files.
import { resolve } from 'node:path'

process.env.LOCAL_STORAGE_PATH = resolve(process.env.LOCAL_STORAGE_PATH || './data/storage')
