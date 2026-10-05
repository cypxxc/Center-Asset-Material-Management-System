import { handleGetSelfHealing, handlePostSelfHealing } from '@/lib/self-healing/api-handler'

export async function GET() {
  return handleGetSelfHealing()
}

export async function POST() {
  return handlePostSelfHealing()
}
