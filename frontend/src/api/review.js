import client from './client.js'

export async function getMyReviews() {
  const response = await client.get('/reviews/me')
  return response.data
}

export async function getUserReviews(userId) {
  const response = await client.get(`/users/${userId}/reviews`)
  return response.data.reviews
}

export async function createReview(trialLessonId, data) {
  const response = await client.post(
    `/trial-lessons/${trialLessonId}/reviews`,
    data,
  )
  return response.data.review
}
