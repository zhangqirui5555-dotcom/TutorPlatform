const toUserResponse = require("../utils/userResponse")

function getCurrentUser(req, res) {
  res.json({
    user: toUserResponse(req.user),
  })
}

module.exports = {
  getCurrentUser,
}
