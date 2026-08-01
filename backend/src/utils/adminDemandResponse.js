function toAdminDemandResponse(demand) {
  return {
    id: demand.id,
    title: demand.title,
    child_grade: demand.childGrade,
    subject: demand.subject,
    region: demand.region,
    status: demand.status,
    visibility_status: demand.visibilityStatus,
    public_summary: demand.publicSummary,
    is_featured: demand.isFeatured,
    sort_weight: demand.sortWeight,
    featured_at: demand.featuredAt,
    featured_until: demand.featuredUntil,
    expires_at: demand.expiresAt,
    listed_at: demand.listedAt,
    unlisted_at: demand.unlistedAt,
    view_count: demand.viewCount,
    published_at: demand.publishedAt,
    created_at: demand.createdAt,
    updated_at: demand.updatedAt,
    parent: demand.parent
      ? {
          id: demand.parent.id,
          display_name: demand.parent.displayName,
          email: demand.parent.email,
          role: demand.parent.role,
          status: demand.parent.status,
        }
      : undefined,
    application_count: demand._count?.applications,
  }
}

function toAdminDemandOperationLogResponse(log) {
  return {
    id: log.id,
    action: log.action,
    target_type: log.targetType,
    target_id: log.targetId,
    before_data: log.beforeData,
    after_data: log.afterData,
    reason: log.reason,
    created_at: log.createdAt,
    admin: log.admin
      ? {
          id: log.admin.id,
          display_name: log.admin.displayName,
        }
      : undefined,
  }
}

module.exports = {
  toAdminDemandOperationLogResponse,
  toAdminDemandResponse,
}
