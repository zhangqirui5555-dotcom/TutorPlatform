function positiveId(value) {
  const id = Number(value)
  return Number.isInteger(id) && id > 0 ? id : null
}

export function trialCreationContexts(applications = [], orders = []) {
  const acceptedApplications = new Map(
    applications
      .filter((application) => application?.status === 'ACCEPTED')
      .map((application) => [positiveId(application.id), application]),
  )

  return orders.flatMap((order) => {
    const applicationId = positiveId(order?.application_id)
    const orderId = positiveId(order?.id)
    const application = acceptedApplications.get(applicationId)

    if (!application || !orderId) return []

    return [{
      application,
      applicationId,
      order,
      orderId,
    }]
  })
}

export function resolveTrialCreationApplicationId(
  contexts = [],
  { applicationId, orderId, currentApplicationId } = {},
) {
  const requestedApplicationId = positiveId(applicationId)
  const requestedOrderId = positiveId(orderId)
  const currentId = positiveId(currentApplicationId)

  const requested = contexts.find((context) => {
    if (requestedApplicationId && requestedOrderId) {
      return context.applicationId === requestedApplicationId
        && context.orderId === requestedOrderId
    }
    if (requestedApplicationId) {
      return context.applicationId === requestedApplicationId
    }
    return requestedOrderId && context.orderId === requestedOrderId
  })
  if (requested) return String(requested.applicationId)

  if (contexts.some((context) => context.applicationId === currentId)) {
    return String(currentId)
  }

  return contexts[0] ? String(contexts[0].applicationId) : ''
}

export function buildTrialLessonRequest(form = {}, contexts = []) {
  const applicationId = positiveId(form.application_id)
  const context = contexts.find((item) => item.applicationId === applicationId)

  if (!context) {
    throw new Error('请选择有效的已接受申请和关联订单。')
  }

  const start = new Date(form.scheduled_start_at)
  const end = new Date(form.scheduled_end_at)

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new Error('请选择有效的开始和结束时间。')
  }

  if (end <= start) {
    throw new Error('结束时间必须晚于开始时间。')
  }

  const location = typeof form.location_or_link === 'string'
    ? form.location_or_link.trim()
    : ''

  return {
    applicationId,
    orderId: context.orderId,
    payload: {
      scheduled_start_at: start.toISOString(),
      scheduled_end_at: end.toISOString(),
      method: form.method,
      ...(location ? { location_or_link: location } : {}),
    },
  }
}

export function trialLessonErrorMessage(
  error,
  fallback = '试课创建失败，请稍后重试。',
) {
  return error?.response?.data?.error?.message || error?.message || fallback
}

export function orderTrialLessonPath(rolePath, order) {
  const basePath = `/${rolePath}/trial-lessons`
  if (rolePath !== 'student') return basePath

  const applicationId = positiveId(order?.application_id)
  const orderId = positiveId(order?.id)
  if (!applicationId || !orderId) return basePath

  return `${basePath}?application_id=${applicationId}&order_id=${orderId}`
}
