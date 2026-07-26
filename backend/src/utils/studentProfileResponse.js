function parseStringArray(value) {
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function toStudentProfileResponse(profile) {
  return {
    id: profile.id,
    user_id: profile.userId,
    school: profile.school,
    major: profile.major,
    grade: profile.grade,
    subjects: parseStringArray(profile.subjects),
    teaching_experience: profile.teachingExperience,
    bio: profile.bio,
    expected_price_min: profile.expectedPriceMin,
    expected_price_max: profile.expectedPriceMax,
    price_unit: profile.priceUnit,
    currency: profile.currency,
    teaching_regions: parseStringArray(profile.teachingRegions),
    created_at: profile.createdAt,
    updated_at: profile.updatedAt,
  }
}

module.exports = toStudentProfileResponse
