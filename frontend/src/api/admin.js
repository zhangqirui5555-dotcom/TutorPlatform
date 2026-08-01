import client from './client.js'

export async function getAdminUsers(params = {}) {
  const response = await client.get('/admin/users', { params })
  return response.data.users
}

export async function updateAdminUserStatus(id, status) {
  const response = await client.patch(`/admin/users/${id}/status`, { status })
  return response.data.user
}

export async function getGovernanceOverview() {
  const response = await client.get('/admin/governance')
  return response.data
}

export async function closeGovernanceDemand(id) {
  const response = await client.post(`/admin/demands/${id}/close`)
  return response.data.demand
}

export async function reopenGovernanceDemand(id) {
  const response = await client.post(`/admin/demands/${id}/reopen`)
  return response.data.demand
}

export async function getAdminDemands(params = {}) {
  const response = await client.get('/admin/demands', { params })
  return response.data
}

export async function updateDemandVisibility(id, data) {
  const response = await client.patch(`/admin/demands/${id}/visibility`, data)
  return response.data.demand
}

export async function updateDemandFeature(id, data) {
  const response = await client.patch(`/admin/demands/${id}/feature`, data)
  return response.data.demand
}

export async function updateDemandExpiry(id, data) {
  const response = await client.patch(`/admin/demands/${id}/expiry`, data)
  return response.data.demand
}

export async function getDemandOperationLogs(id, params = {}) {
  const response = await client.get(`/admin/demands/${id}/operation-logs`, { params })
  return response.data
}

