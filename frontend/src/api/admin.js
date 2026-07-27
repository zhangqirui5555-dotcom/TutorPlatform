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

