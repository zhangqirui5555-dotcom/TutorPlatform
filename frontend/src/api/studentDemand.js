import client from './client.js'

export async function getDemands(filters = {}) {
  const params = {}

  if (filters.subject?.trim()) {
    params.subject = filters.subject.trim()
  }

  if (filters.region?.trim()) {
    params.region = filters.region.trim()
  }

  const response = await client.get('/demands', { params })
  return response.data.demands
}

export async function getDemandDetail(demandId) {
  const response = await client.get(`/demands/${demandId}`)
  return response.data.demand
}
