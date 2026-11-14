import { listCapabilities } from '../capabilities/registry'

export default defineEventHandler(async (event) => {
  const refresh = getQuery(event).refresh === '1'
  return {
    capabilities: await listCapabilities(refresh),
  }
})
