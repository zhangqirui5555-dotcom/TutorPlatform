export function resolveTrialLessonTarget(value, trialLessons = []) {
  const id = Number(value)
  if (!Number.isSafeInteger(id) || id <= 0) return null

  return trialLessons.some((trialLesson) => trialLesson?.id === id) ? id : null
}
