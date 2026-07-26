import client from './client.js'

export async function getMyDemands() {
  const response = await client.get('/parents/me/demands')
  return response.data.demands
}

export async function createDemand(data) {
  const response = await client.post('/demands', data)
  return response.data.demand
}

export async function publishDemand(demandId) {
  const response = await client.post(`/demands/${demandId}/publish`)
  return response.data.demand
}

export async function closeDemand(demandId) {
  const response = await client.post(`/demands/${demandId}/close`)
  return response.data.demand
}
