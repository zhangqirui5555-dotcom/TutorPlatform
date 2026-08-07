export const ORDER_STATUS = {
  PENDING: {
    label: '待确认金额',
    description: '订单已经建立，等待家长确认服务金额。',
  },
  CONFIRMED: {
    label: '待学生确认',
    description: '条款已设置，等待学生确认订单。',
  },
  IN_PROGRESS: {
    label: '服务进行中',
    description: '双方已确认订单，可以沟通并安排试课。',
  },
  COMPLETED: {
    label: '已完成',
    description: '订单服务已经完成。',
  },
  CANCELLED: {
    label: '已取消',
    description: '订单已取消，请查看取消原因。',
  },
}

export const ORDER_STATUS_OPTIONS = Object.entries(ORDER_STATUS).map(
  ([value, item]) => ({ value, label: item.label }),
)

const ORDER_NEXT_STEPS = {
  PENDING: '家长确认本次家教服务金额',
  CONFIRMED: '等待学生确认订单',
  IN_PROGRESS: '沟通并完成试课',
  COMPLETED: '本次服务已完成',
  CANCELLED: '订单已取消',
}

export function formatOrderStatus(status) {
  return ORDER_STATUS[status]?.label || '未知状态'
}

export function orderNextStep(status) {
  return ORDER_NEXT_STEPS[status] || '查看订单最新状态'
}

export function formatMoney(amount, currency = 'CNY') {
  if (!Number.isSafeInteger(amount)) {
    return '待确认'
  }

  const sign = amount < 0 ? '-' : ''
  const absolute = Math.abs(amount)
  const major = Math.floor(absolute / 100).toLocaleString('zh-CN')
  const minor = String(absolute % 100).padStart(2, '0')
  const prefix = currency === 'CNY' ? '¥' : `${currency} `

  return `${sign}${prefix}${major}.${minor}`
}

export function formatPlatformFee(amount, currency = 'CNY') {
  return Number.isSafeInteger(amount) ? formatMoney(amount, currency) : '暂未确定'
}

export function orderTimelineItems(order = {}) {
  return [
    { label: '匹配成功', value: order.created_at },
    { label: '家长确认金额', value: order.confirmed_at },
    { label: '学生确认并开始服务', value: order.started_at },
    order.status === 'CANCELLED'
      ? { label: '订单取消', value: order.cancelled_at }
      : { label: '订单完成', value: order.completed_at },
  ].filter((item) => item.value)
}

export function trialCompletionGuidance(trialLessons = []) {
  const statuses = new Set(trialLessons.map((trialLesson) => trialLesson?.status))

  if (statuses.has('COMPLETED')) {
    return {
      canComplete: true,
      message: '已完成至少一次试课，可以确认本次订单完成。',
    }
  }
  if (statuses.has('PENDING_CONFIRMATION')) {
    return {
      canComplete: false,
      message: '当前有试课等待确认。至少完成一次试课后，才能确认本次订单完成。',
    }
  }
  if (statuses.has('CONFIRMED')) {
    return {
      canComplete: false,
      message: '请先完成已确认的试课，再确认本次订单完成。',
    }
  }

  return {
    canComplete: false,
    message: '至少完成一次试课后，才能确认本次订单完成。',
  }
}

export function centsToYuanInput(amount) {
  if (!Number.isSafeInteger(amount)) return ''

  const absolute = Math.abs(amount)
  const major = Math.floor(absolute / 100)
  const minor = String(absolute % 100).padStart(2, '0')
  return `${amount < 0 ? '-' : ''}${major}.${minor}`
}

export function yuanInputToCents(value) {
  const normalized = String(value).trim()
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) {
    return null
  }

  const [major, minor = ''] = normalized.split('.')
  const cents = BigInt(major) * 100n + BigInt(minor.padEnd(2, '0'))
  if (cents <= 0n || cents > BigInt(Number.MAX_SAFE_INTEGER)) {
    return null
  }

  return Number(cents)
}

export function formatDateTime(value, fallback = '尚未发生') {
  if (!value) return fallback

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return fallback

  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

export function maskName(name) {
  const value = String(name || '').trim()
  if (!value) return '家长用户'
  if (value.length === 1) return `${value}*`
  return `${value.slice(0, 1)}${'*'.repeat(Math.min(2, value.length - 1))}`
}

export function maskEmail(email) {
  const [local, domain] = String(email || '').split('@')
  if (!local || !domain) return ''
  const visible = local.slice(0, Math.min(2, local.length))
  return `${visible}${'*'.repeat(Math.max(2, Math.min(5, local.length - visible.length)))}@${domain}`
}

const ERROR_MESSAGES = {
  ORDER_ACCESS_DENIED: '你无权查看或操作该订单。',
  ORDER_ACTION_FORBIDDEN: '当前账号不能执行此订单操作。',
  ORDER_NOT_FOUND: '订单不存在或已不可访问。',
  INVALID_ORDER_STATUS: '订单状态已经变化，请刷新后重试。',
  ORDER_ALREADY_UPDATED: '订单刚刚被其他请求更新，请刷新后重试。',
  ORDER_TERMS_REQUIRED: '请先由家长确认服务金额。',
  COMPLETED_TRIAL_LESSON_REQUIRED: '至少完成一次试课后才能完成订单。',
  CANCELLATION_REASON_REQUIRED: '请填写取消原因。',
  CANCELLATION_REASON_TOO_LONG: '取消原因不能超过500个字符。',
  INVALID_ORDER_AMOUNT: '请输入有效的服务金额。',
  AUTHENTICATION_REQUIRED: '登录状态已失效，请重新登录。',
  INVALID_TOKEN: '登录状态已失效，请重新登录。',
}

export function orderErrorMessage(error, fallback = '订单操作失败，请稍后重试。') {
  const apiError = error?.response?.data?.error
  return ERROR_MESSAGES[apiError?.code] || apiError?.message || fallback
}
