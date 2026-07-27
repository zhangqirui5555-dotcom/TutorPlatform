import client from './client.js'

export async function getMyStudentProfile() {
  const response = await client.get('/student-profile/me')
  return response.data.profile
}

export async function saveMyStudentProfile(profile) {
  const response = await client.put('/student-profile/me', profile)
  return response.data.profile
}
