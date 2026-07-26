const reviewService = require("../services/reviewService")

async function submitReview(req, res) {
  const review = await reviewService.submitReview(
    req.user.id,
    req.params.trialLessonId,
    req.body || {},
  )
  res.status(201).json({ review })
}

async function getReceivedReviews(req, res) {
  const reviews = await reviewService.getReceivedReviews(req.params.userId)
  res.json({ reviews })
}

async function getMyReviews(req, res) {
  const reviews = await reviewService.getMyReviews(req.user.id)
  res.json(reviews)
}

module.exports = {
  getMyReviews,
  getReceivedReviews,
  submitReview,
}
