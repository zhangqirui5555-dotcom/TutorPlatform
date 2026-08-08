function toTimestamp(value) {
  const timestamp = value instanceof Date
    ? value.getTime()
    : new Date(value).getTime()

  if (Number.isNaN(timestamp)) {
    throw new TypeError("Trial lesson time must be a valid date")
  }

  return timestamp
}

function hasTrialLessonEnded(scheduledEndAt, currentTime) {
  return toTimestamp(currentTime) >= toTimestamp(scheduledEndAt)
}

module.exports = {
  hasTrialLessonEnded,
}
