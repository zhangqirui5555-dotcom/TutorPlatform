function toDemandResponse(demand, { includePrivateFields = false } = {}) {
  const response = {
    id: demand.id,
    parent_id: demand.parentId,
    title: demand.title,
    child_grade: demand.childGrade,
    subject: demand.subject,
    region: demand.region,
    schedule_description: demand.scheduleDescription,
    budget_min: demand.budgetMin,
    budget_max: demand.budgetMax,
    price_unit: demand.priceUnit,
    currency: demand.currency,
    description: demand.description,
    status: demand.status,
    published_at: demand.publishedAt,
    matched_at: demand.matchedAt,
    completed_at: demand.completedAt,
    closed_at: demand.closedAt,
    created_at: demand.createdAt,
    updated_at: demand.updatedAt,
  }

  if (includePrivateFields) {
    response.address_detail = demand.addressDetail
  }

  return response
}

module.exports = toDemandResponse
