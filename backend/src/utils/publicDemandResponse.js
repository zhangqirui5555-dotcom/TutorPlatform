function toPublicDemandResponse(demand) {
  return {
    id: demand.id,
    title: demand.title,
    child_grade: demand.childGrade,
    subject: demand.subject,
    region: demand.region,
    schedule_description: demand.scheduleDescription,
    budget_min: demand.budgetMin,
    budget_max: demand.budgetMax,
    price_unit: demand.priceUnit,
    currency: demand.currency,
    public_summary: demand.publicSummary,
    is_featured: demand.isFeatured,
    published_at: demand.publishedAt,
    expires_at: demand.expiresAt,
  }
}

module.exports = toPublicDemandResponse
