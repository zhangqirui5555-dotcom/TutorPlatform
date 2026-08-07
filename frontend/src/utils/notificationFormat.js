const CATEGORY_LABELS = {
  APPLICATION: '申请通知',
  ORDER: '订单通知',
  TRIAL_LESSON: '试课通知',
  MESSAGE: '消息通知',
}

const DEFAULT_DISPLAY = {
  title: '平台通知',
  body: '有新的业务进展，请点击查看详情。',
}

function notificationPayload(notification) {
  return notification?.payload
    && typeof notification.payload === 'object'
    && !Array.isArray(notification.payload)
    ? notification.payload
    : {}
}

function compactReason(value, maximumLength = 60) {
  if (typeof value !== 'string') return ''

  const reason = value.replace(/\s+/g, ' ').trim()
  if (!reason || ['null', 'undefined', '[object Object]'].includes(reason.toLowerCase())) {
    return ''
  }

  return reason.length > maximumLength
    ? `${reason.slice(0, maximumLength)}…`
    : reason
}

function applicationDisplay(type, role, payload) {
  if (type === 'APPLICATION_RECEIVED') {
    return role === 'STUDENT'
      ? {
          title: '家教申请已提交',
          body: '你的申请已提交，可以在申请记录中查看处理进展。',
        }
      : {
          title: '收到新的家教申请',
          body: '有大学生申请了你的家教需求，点击查看申请资料。',
        }
  }

  if (type === 'APPLICATION_ACCEPTED') {
    return role === 'PARENT'
      ? {
          title: '家教申请已通过',
          body: '申请已通过，可以在申请页面查看最新状态。',
        }
      : {
          title: '你的家教申请已通过',
          body: positiveInteger(payload.order_id)
            ? '家长已接受你的申请，可以查看订单并开始沟通。'
            : '家长已接受你的申请，可以在申请记录中查看最新进展。',
        }
  }

  if (type === 'APPLICATION_REJECTED') {
    return role === 'PARENT'
      ? {
          title: '家教申请已处理',
          body: '该申请已处理，可以继续查看其他学生资料。',
        }
      : {
          title: '本次家教申请未通过',
          body: '这次申请暂未被选择，可以继续看看其他合适的家教需求。',
        }
  }

  return DEFAULT_DISPLAY
}

function orderDisplay(type, role, payload) {
  if (type === 'ORDER_CONFIRMED') {
    return role === 'PARENT'
      ? {
          title: '订单条款已确认',
          body: '订单条款已确认，可以查看课程金额和服务信息。',
        }
      : {
          title: '家长已确认订单条款',
          body: '请查看课程金额和服务信息，确认无误后即可开始。',
        }
  }

  if (type === 'ORDER_IN_PROGRESS') {
    return role === 'STUDENT'
      ? {
          title: '订单已进入服务阶段',
          body: '双方已确认订单，可以继续沟通并安排试课。',
        }
      : {
          title: '学生已确认订单',
          body: '订单已进入服务阶段，可以继续沟通并安排试课。',
        }
  }

  if (type === 'ORDER_COMPLETED') {
    return {
      title: '订单已完成',
      body: '本次家教服务已完成，可以查看订单和评价。',
    }
  }

  if (type === 'ORDER_CANCELLED') {
    const reason = compactReason(payload.cancellation_reason)
    return {
      title: '订单已取消',
      body: reason
        ? `订单已取消。原因：${reason}`
        : '该家教订单已取消，请查看订单详情。',
    }
  }

  return DEFAULT_DISPLAY
}

function trialLessonDisplay(type, payload) {
  if (type === 'TRIAL_LESSON_PROPOSED') {
    return {
      title: '收到新的试课安排',
      body: '对方发起了新的试课安排，点击查看试课安排。',
    }
  }

  if (type === 'TRIAL_LESSON_CONFIRMED') {
    return {
      title: '试课安排已确认',
      body: '双方已确认本次试课安排，请按约定时间进行。',
    }
  }

  if (type === 'TRIAL_LESSON_CANCELLED') {
    const reason = compactReason(payload.cancellation_reason)
    return {
      title: '试课已取消',
      body: reason
        ? `本次试课安排已取消。原因：${reason}`
        : '本次试课安排已取消。',
    }
  }

  if (type === 'TRIAL_LESSON_COMPLETED') {
    return {
      title: '试课已完成',
      body: '本次试课已经完成，可以继续处理订单或评价。',
    }
  }

  return DEFAULT_DISPLAY
}

function positiveInteger(value) {
  const number = Number(value)
  return Number.isSafeInteger(number) && number > 0 ? number : null
}

function sameDate(left, right) {
  return left.getFullYear() === right.getFullYear()
    && left.getMonth() === right.getMonth()
    && left.getDate() === right.getDate()
}

function clockTime(date) {
  return new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)
}

export function notificationCategory(type = '') {
  if (type.startsWith('APPLICATION_')) return CATEGORY_LABELS.APPLICATION
  if (type.startsWith('ORDER_')) return CATEGORY_LABELS.ORDER
  if (type.startsWith('TRIAL_LESSON_')) return CATEGORY_LABELS.TRIAL_LESSON
  if (type === 'MESSAGE_RECEIVED') return CATEGORY_LABELS.MESSAGE
  return '平台通知'
}

export function notificationDisplay(notification = {}, role = '') {
  const type = typeof notification.type === 'string'
    ? notification.type.toUpperCase()
    : ''
  const payload = notificationPayload(notification)

  if (type.startsWith('APPLICATION_')) return applicationDisplay(type, role, payload)
  if (type.startsWith('ORDER_')) return orderDisplay(type, role, payload)
  if (type.startsWith('TRIAL_LESSON_')) return trialLessonDisplay(type, payload)
  if (type === 'MESSAGE_RECEIVED') {
    return {
      title: '你有一条新消息',
      body: '对方给你发送了新消息，点击查看。',
    }
  }

  return DEFAULT_DISPLAY
}

export function formatNotificationTime(value, nowValue = Date.now()) {
  const date = new Date(value)
  const now = new Date(nowValue)
  if (Number.isNaN(date.getTime())) return '时间未知'

  const difference = Math.max(0, now.getTime() - date.getTime())
  const minutes = Math.floor(difference / 60000)
  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes}分钟前`

  const hours = Math.floor(minutes / 60)
  if (hours < 6) return `${hours}小时前`
  if (sameDate(date, now)) return `今天 ${clockTime(date)}`

  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  if (sameDate(date, yesterday)) return `昨天 ${clockTime(date)}`

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function notificationTarget(notification, role) {
  const payload = notificationPayload(notification)
  const resourceId = positiveInteger(notification.resource_id)

  if (notification.type?.startsWith('ORDER_') || notification.resource_type === 'ORDER') {
    const orderId = positiveInteger(payload.order_id || resourceId)
    if (!orderId) return null
    if (role === 'PARENT') return `/parent/orders/${orderId}`
    if (role === 'STUDENT') return `/student/orders/${orderId}`
    if (role === 'ADMIN') return `/admin/orders/${orderId}`
  }

  if (notification.type?.startsWith('APPLICATION_')) {
    if (role === 'PARENT') {
      const demandId = positiveInteger(payload.demand_id)
      return demandId
        ? `/parent/demands/${demandId}/applications`
        : '/parent/applications'
    }
    if (role === 'STUDENT') {
      const orderId = notification.type === 'APPLICATION_ACCEPTED'
        ? positiveInteger(payload.order_id)
        : null
      return orderId ? `/student/orders/${orderId}` : '/student/applications'
    }
  }

  if (notification.resource_type === 'TRIAL_LESSON'
    || notification.type?.startsWith('TRIAL_LESSON_')) {
    const trialLessonId = positiveInteger(payload.trial_lesson_id || resourceId)
    const query = trialLessonId ? `?trial_lesson_id=${trialLessonId}` : ''
    if (role === 'PARENT') return `/parent/trial-lessons${query}`
    if (role === 'STUDENT') return `/student/trial-lessons${query}`
  }

  if (notification.type === 'MESSAGE_RECEIVED') {
    const conversationId = positiveInteger(payload.conversation_id || resourceId)
    const query = conversationId ? `?conversation_id=${conversationId}` : ''
    if (role === 'PARENT') return `/parent/messages${query}`
    if (role === 'STUDENT') return `/student/messages${query}`
  }

  return null
}

const ERROR_MESSAGES = {
  NOTIFICATION_NOT_FOUND: '该通知已不存在或无法访问。',
  NOTIFICATION_ACCESS_DENIED: '你无权访问该通知。',
  AUTHENTICATION_REQUIRED: '登录状态已失效，请重新登录。',
  INVALID_TOKEN: '登录状态已失效，请重新登录。',
}

export function notificationErrorMessage(error, fallback = '通知操作失败，请稍后重试。') {
  const apiError = error?.response?.data?.error
  if (ERROR_MESSAGES[apiError?.code]) return ERROR_MESSAGES[apiError.code]
  if (error?.response?.status === 403) return '你无权访问该通知。'
  if (error?.response?.status === 404) return '该通知已不存在或无法访问。'
  if (error?.response?.status >= 500) return '通知服务暂时不可用，请稍后重试。'
  return apiError?.message || fallback
}
