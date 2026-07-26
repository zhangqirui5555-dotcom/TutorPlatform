import client from './client.js'

export async function getTrialLessons() {
  const response = await client.get('/trial-lessons')
  return response.data.trial_lessons
}

export async function getTrialLessonDetail(trialLessonId) {
  const response = await client.get(`/trial-lessons/${trialLessonId}`)
  return response.data.trial_lesson
}

export async function createTrialLesson(applicationId, data) {
  const response = await client.post(
    `/applications/${applicationId}/trial-lessons`,
    data,
  )
  return response.data.trial_lesson
}

export async function confirmTrialLesson(trialLessonId) {
  const response = await client.post(`/trial-lessons/${trialLessonId}/confirm`)
  return response.data.trial_lesson
}

export async function cancelTrialLesson(trialLessonId, cancellationReason = '') {
  const response = await client.post(`/trial-lessons/${trialLessonId}/cancel`, {
    cancellation_reason: cancellationReason || undefined,
  })
  return response.data.trial_lesson
}

export async function completeTrialLesson(trialLessonId) {
  const response = await client.post(`/trial-lessons/${trialLessonId}/complete`)
  return response.data.trial_lesson
}
