const PRICE_UNIT_LABELS = {
  PER_HOUR: '/小时',
  PER_SESSION: '/次',
  PER_MONTH: '/月',
}

export function formatYuan(cents, currency = 'CNY') {
  if (!Number.isFinite(cents)) return '面议'
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency,
    minimumFractionDigits: Number.isInteger(cents / 100) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(cents / 100)
}

export function formatBudget(demand) {
  const minimum = formatYuan(demand.budget_min, demand.currency)
  const maximum = formatYuan(demand.budget_max, demand.currency)
  const range = minimum === maximum ? minimum : `${minimum}–${maximum}`
  return `${range}${PRICE_UNIT_LABELS[demand.price_unit] || ''}`
}
