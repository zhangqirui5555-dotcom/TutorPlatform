function toCertificationResponse(certification) {
  const response = {
    id: certification.id,
    student_id: certification.studentId,
    material_path: certification.materialPath,
    material_type: certification.materialType,
    status: certification.status,
    submitted_at: certification.submittedAt,
    reviewed_at: certification.reviewedAt,
    reviewed_by: certification.reviewedBy,
    rejection_reason: certification.rejectionReason,
    created_at: certification.createdAt,
    updated_at: certification.updatedAt,
  }

  if (certification.student) {
    response.student = {
      id: certification.student.id,
      email: certification.student.email,
      display_name: certification.student.displayName,
      profile: certification.student.studentProfile
        ? {
            school: certification.student.studentProfile.school,
            major: certification.student.studentProfile.major,
            grade: certification.student.studentProfile.grade,
          }
        : null,
    }
  }

  return response
}

module.exports = toCertificationResponse
