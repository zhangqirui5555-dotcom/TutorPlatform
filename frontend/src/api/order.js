import client from './client.js'

export async function getOrders(params = {}) {
  const response = await client.get('/orders', { params })
  return response.data
}

export async function getOrder(orderId) {
  const response = await client.get(`/orders/${orderId}`)
  return response.data.order
}

export async function updateOrderTerms(orderId, data) {
  const response = await client.patch(`/orders/${orderId}/terms`, data)
  return response.data.order
}

export async function confirmOrder(orderId) {
  const response = await client.patch(`/orders/${orderId}/confirm`)
  return response.data.order
}

export async function completeOrder(orderId) {
  const response = await client.patch(`/orders/${orderId}/complete`)
  return response.data.order
}

export async function cancelOrder(orderId, cancellationReason) {
  const response = await client.patch(`/orders/${orderId}/cancel`, {
    cancellation_reason: cancellationReason,
  })
  return response.data.order
}
