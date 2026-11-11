import { cache } from 'react'
import { getPostgresProfile } from '@/lib/postgres/session'

export const getCurrentProfile = cache(async () => getPostgresProfile())
