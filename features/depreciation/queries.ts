import 'server-only'
import { getPostgresDepreciationReport } from './postgres-queries'

export async function getDepreciationReport() {
  return getPostgresDepreciationReport()
}
