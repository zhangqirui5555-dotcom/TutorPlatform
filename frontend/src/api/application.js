import client from './client.js'

export async function createApplication(demandId, coverMessage) {
  const response = await client.post(`/demands/${demandId}/applications`, {
    cover_message: coverMessage,
  })
  return response.data.application
}

export async function getMyApplications() {
  const response = await client.get('/applications/me')
  return response.data.applications
}

export async function getDemandApplications(demandId) {
  const response = await client.get(`/demands/${demandId}/applications`)
  return response.data.applications
}

export async function acceptApplication(applicationId) {
  const response = await client.post(`/applications/${applicationId}/accept`)
  return response.data
}

export async function rejectApplication(applicationId) {
  const response = await client.post(`/applications/${applicationId}/reject`)
  return response.data.application
}
