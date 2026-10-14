export function isPostgresBackend(): boolean {
  return process.env.DATA_BACKEND === 'postgres'
}
