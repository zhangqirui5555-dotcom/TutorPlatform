const DEFAULT_MESSAGE = '操作未完成，请稍后重试。'
const NETWORK_MESSAGE = '网络连接异常，请稍后重试。'

export const API_ERROR_MESSAGES = {
  EMAIL_ALREADY_EXISTS: '该邮箱已注册，请直接登录或使用其他邮箱。',
  INVALID_CREDENTIALS: '邮箱或密码不正确。',
  ACCOUNT_NOT_ACTIVE: '当前账号不可用，请联系平台管理员。',
  AUTHENTICATION_REQUIRED: '登录状态已失效，请重新登录。',
  INVALID_TOKEN: '登录状态已失效，请重新登录。',
  FORBIDDEN: '你没有权限执行此操作。',
  DEMAND_NOT_AVAILABLE: '当前家教需求暂不可申请。',
  DEMAND_NOT_LISTABLE: '当前需求已不处于招募状态，无法执行上架。',
  INVALID_ORDER_STATUS: '订单状态已发生变化，请刷新后重试。',
  ORDER_ALREADY_UPDATED: '订单状态已发生变化，请刷新后重试。',
  DEMAND_NOT_MATCHED: '关联需求状态已发生变化，请刷新后重试。',
  COMPLETED_TRIAL_LESSON_REQUIRED: '完成试课后才能完成订单。',
  TRIAL_LESSON_NOT_ENDED: '试课尚未结束，暂不能标记为完成。',
  TRIAL_LESSON_NOT_COMPLETED: '试课完成后才能提交评价。',
  INVALID_TRIAL_LESSON_STATUS: '试课状态已发生变化，请刷新后重试。',
  TRIAL_LESSON_ALREADY_UPDATED: '试课状态已发生变化，请刷新后重试。',
  APPLICATION_NOT_ACCEPTED: '当前申请尚未通过，无法安排试课。',
  REVIEW_ALREADY_EXISTS: '你已经提交过本次试课评价。',
}

const HTTP_STATUS_MESSAGES = {
  400: '请求信息有误，请检查后重试。',
  401: '登录状态已失效，请重新登录。',
  403: '你没有权限执行此操作。',
  404: '相关内容不存在或已被删除。',
  409: '当前状态已发生变化，请刷新后重试。',
}

const TECHNICAL_MESSAGE_PATTERN = /(?:axios|network error|prisma|postgres|database|sql|stack|aws|cos|s3|internal server|[a-z]:\\|\/usr\/|\/var\/)/i
const CHINESE_PATTERN = /[\u3400-\u9fff]/

function approvedChineseMessage(value) {
  if (typeof value !== 'string') return ''
  const message = value.trim()
  if (!message || !CHINESE_PATTERN.test(message) || TECHNICAL_MESSAGE_PATTERN.test(message)) {
    return ''
  }
  return message
}

function isNetworkFailure(error) {
  return !error?.response && (
    error?.code === 'ERR_NETWORK'
    || error?.code === 'ECONNABORTED'
    || error?.request
    || /network error|timeout/i.test(error?.message || '')
  )
}

export function apiErrorMessage(
  error,
  fallback = DEFAULT_MESSAGE,
  codeMessages = {},
) {
  const apiError = error?.response?.data?.error
  const code = apiError?.code
  const mapped = codeMessages[code] || API_ERROR_MESSAGES[code]
  if (mapped) return mapped

  const approvedApiMessage = approvedChineseMessage(apiError?.message)
  if (approvedApiMessage) return approvedApiMessage

  const statusMessage = HTTP_STATUS_MESSAGES[error?.response?.status]
  if (statusMessage) return statusMessage
  if (error?.response?.status >= 500) return DEFAULT_MESSAGE

  if (isNetworkFailure(error)) return NETWORK_MESSAGE

  const approvedLocalMessage = approvedChineseMessage(
    error?.userMessage || error?.message,
  )
  if (approvedLocalMessage) return approvedLocalMessage

  return approvedChineseMessage(fallback) || DEFAULT_MESSAGE
}

export function normalizeApiError(error) {
  const userMessage = apiErrorMessage(error)
  error.userMessage = userMessage

  if (error.response?.data && typeof error.response.data === 'object') {
    const responseData = error.response.data
    error.response.data = {
      ...responseData,
      ...(typeof responseData.message === 'string'
        ? { message: userMessage }
        : {}),
      ...(responseData.error && typeof responseData.error === 'object'
        ? {
            error: {
              ...responseData.error,
              message: userMessage,
            },
          }
        : {}),
    }
  }

  return error
}
