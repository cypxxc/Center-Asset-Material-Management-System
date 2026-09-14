export function isPostgresBackend() {
  return process.env.DATA_BACKEND === 'postgres'
}
