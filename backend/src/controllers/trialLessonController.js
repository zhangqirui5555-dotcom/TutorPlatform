const trialLessonService = require("../services/trialLessonService")

async function createTrialLesson(req, res) {
  const trialLesson = await trialLessonService.createTrialLesson(
    req.user.id,
    req.params.applicationId,
    req.body || {},
  )
  res.status(201).json({ trial_lesson: trialLesson })
}

async function getMyTrialLessons(req, res) {
  const trialLessons = await trialLessonService.getMyTrialLessons(req.user.id)
  res.json({ trial_lessons: trialLessons })
}

async function getTrialLesson(req, res) {
  const trialLesson = await trialLessonService.getTrialLesson(req.user.id, req.params.id)
  res.json({ trial_lesson: trialLesson })
}

async function confirmTrialLesson(req, res) {
  const trialLesson = await trialLessonService.confirmTrialLesson(
    req.user.id,
    req.params.id,
  )
  res.json({ trial_lesson: trialLesson })
}

async function cancelTrialLesson(req, res) {
  const trialLesson = await trialLessonService.cancelTrialLesson(
    req.user.id,
    req.params.id,
    req.body || {},
  )
  res.json({ trial_lesson: trialLesson })
}

async function completeTrialLesson(req, res) {
  const trialLesson = await trialLessonService.completeTrialLesson(
    req.user.id,
    req.params.id,
  )
  res.json({ trial_lesson: trialLesson })
}

module.exports = {
  cancelTrialLesson,
  completeTrialLesson,
  confirmTrialLesson,
  createTrialLesson,
  getMyTrialLessons,
  getTrialLesson,
}
