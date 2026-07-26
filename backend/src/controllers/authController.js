const authService = require("../services/authService")

async function register(req, res) {
  const result = await authService.register(req.body || {})
  res.status(201).json(result)
}

async function login(req, res) {
  const result = await authService.login(req.body || {})
  res.json(result)
}

module.exports = {
  login,
  register,
}
