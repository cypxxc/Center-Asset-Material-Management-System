// A UI freshness marker only; authorization still uses the current server profile.
export function profileRevision(profile: { id: string; role: string; updated_at?: string | null }) {
  return JSON.stringify([profile.id, profile.role, profile.updated_at ?? null])
}
