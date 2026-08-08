import { apiErrorMessage } from './apiError.js'

export const ADMIN_DEMAND_STATUS_LABELS = {
  DRAFT: '草稿',
  RECRUITING: '招募中',
  MATCHED: '已匹配',
  COMPLETED: '已完成',
  CANCELLED: '已取消',
  CLOSED: '已关闭',
}

export function adminDemandOperationAvailability(demand = {}) {
  const recruiting = demand.status === 'RECRUITING'
  const visible = demand.visibility_status === 'VISIBLE'

  return {
    canList: recruiting && !visible,
    canUnlist: recruiting && visible,
    canFeature: recruiting && visible && !demand.is_featured,
    canUnfeature: recruiting && visible && Boolean(demand.is_featured),
    canAdjustExpiry: recruiting,
  }
}

export function isAdminDemandPubliclyVisible(demand = {}) {
  return demand.status === 'RECRUITING'
    && demand.visibility_status === 'VISIBLE'
}

export function isAdminDemandEffectivelyFeatured(demand = {}) {
  return isAdminDemandPubliclyVisible(demand) && Boolean(demand.is_featured)
}

export function adminDemandPublicStatusLabel(demand = {}) {
  if (demand.status === 'RECRUITING') {
    return isAdminDemandPubliclyVisible(demand) ? '已上架' : '已下架'
  }
  return adminDemandStatusLabel(demand.status)
}

export function isAdminDemandOperationAllowed(demand, action) {
  const availability = adminDemandOperationAvailability(demand)
  const actionRules = {
    list: availability.canList,
    unlist: availability.canUnlist,
    feature: availability.canFeature,
    unfeature: availability.canUnfeature,
    expiry: availability.canAdjustExpiry,
  }
  return actionRules[action] === true
}

export function adminDemandErrorMessage(error) {
  const backendError = error?.response?.data?.error
  const backend = backendError?.message || error?.response?.data?.message

  if (
    backendError?.code === 'DEMAND_NOT_LISTABLE'
    || backend === 'Only RECRUITING demands can be listed'
  ) {
    return '当前需求已不处于招募状态，无法执行上架。'
  }
  return apiErrorMessage(error, '请求失败，请稍后重试。', {
    DEMAND_NOT_FOUND: '需求不存在或已被删除。',
    DEMAND_NOT_LISTABLE: '当前需求已不处于招募状态，无法执行上架。',
    FORBIDDEN: '你没有需求运营权限。',
  })
}

export function adminDemandStatusLabel(status) {
  return ADMIN_DEMAND_STATUS_LABELS[status] || status
}
