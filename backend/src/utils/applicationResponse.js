function parseJsonArray(value) {
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function toApplicationResponse(application) {
  const response = {
    id: application.id,
    student_id: application.studentId,
    demand_id: application.demandId,
    cover_message: application.coverMessage,
    status: application.status,
    viewed_at: application.viewedAt,
    decided_at: application.decidedAt,
    created_at: application.createdAt,
    updated_at: application.updatedAt,
  }

  if (application.demand) {
    response.demand = {
      id: application.demand.id,
      title: application.demand.title,
      child_grade: application.demand.childGrade,
      subject: application.demand.subject,
      region: application.demand.region,
      status: application.demand.status,
    }
  }

  if (application.student) {
    const profile = application.student.studentProfile
    response.student = {
      id: application.student.id,
      email: application.student.email,
      display_name: application.student.displayName,
      profile: profile
        ? {
            school: profile.school,
            major: profile.major,
            grade: profile.grade,
            subjects: parseJsonArray(profile.subjects),
            teaching_experience: profile.teachingExperience,
            bio: profile.bio,
            expected_price_min: profile.expectedPriceMin,
            expected_price_max: profile.expectedPriceMax,
            teaching_regions: parseJsonArray(profile.teachingRegions),
          }
        : null,
    }
  }

  return response
}

module.exports = toApplicationResponse
