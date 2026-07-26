function toUserResponse(user) {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    display_name: user.displayName,
  }
}

module.exports = toUserResponse
