function availableDemandWhere(now = new Date()) {
  return {
    status: "RECRUITING",
    visibilityStatus: "VISIBLE",
    parent: {
      is: {
        role: "PARENT",
        status: "ACTIVE",
      },
    },
    OR: [
      { expiresAt: null },
      { expiresAt: { gt: now } },
    ],
  }
}

module.exports = availableDemandWhere
