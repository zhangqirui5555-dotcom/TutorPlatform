function positiveId(value) {
  const id = Number(value)
  return Number.isSafeInteger(id) && id > 0 ? id : null
}

export function matchFlowPaths(resources = {}, role = 'PARENT') {
  const rolePath = role === 'STUDENT' ? 'student' : 'parent'
  const orderId = positiveId(resources.orderId)
  const conversationId = positiveId(resources.conversationId)

  return {
    order: orderId ? `/${rolePath}/orders/${orderId}` : `/${rolePath}/orders`,
    messages: conversationId
      ? `/${rolePath}/messages?conversation_id=${conversationId}`
      : `/${rolePath}/messages`,
    trials: `/${rolePath}/trial-lessons`,
  }
}

export function resourcesFromAcceptResult(result = {}) {
  return {
    orderId: positiveId(result?.order?.id),
    conversationId: positiveId(result?.conversation?.id),
  }
}

export function applicationResourceMap(applications = [], orders = [], conversations = []) {
  const resources = Object.fromEntries(
    applications
      .filter((application) => application?.status === 'ACCEPTED')
      .map((application) => [application.id, { orderId: null, conversationId: null }]),
  )

  for (const order of orders) {
    const applicationId = positiveId(order?.application_id)
    if (resources[applicationId]) resources[applicationId].orderId = positiveId(order.id)
  }

  for (const conversation of conversations) {
    const applicationId = positiveId(conversation?.application_id)
    if (resources[applicationId]) {
      resources[applicationId].conversationId = positiveId(conversation.id)
    }
  }

  return resources
}
