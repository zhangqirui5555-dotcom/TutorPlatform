const orderService = require("../services/orderService")

async function getOrders(req, res) {
  const result = await orderService.getOrders(req.user, req.query)
  res.json(result)
}

async function getOrder(req, res) {
  const order = await orderService.getOrder(req.user, Number(req.params.id))
  res.json({ order })
}

async function updateTerms(req, res) {
  const order = await orderService.updateTerms(
    req.user,
    Number(req.params.id),
    req.body || {},
  )
  res.json({ order })
}

async function confirmOrder(req, res) {
  const order = await orderService.confirmOrder(req.user, Number(req.params.id))
  res.json({ order })
}

async function completeOrder(req, res) {
  const order = await orderService.completeOrder(req.user, Number(req.params.id))
  res.json({ order })
}

async function cancelOrder(req, res) {
  const order = await orderService.cancelOrder(
    req.user,
    Number(req.params.id),
    req.body || {},
  )
  res.json({ order })
}

module.exports = {
  cancelOrder,
  completeOrder,
  confirmOrder,
  getOrder,
  getOrders,
  updateTerms,
}
