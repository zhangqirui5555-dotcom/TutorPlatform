import { apiErrorMessage } from './apiError.js'

const ADMIN_TEMPORARY_MESSAGE = '认证材料暂时无法读取，请稍后重试。'
const STUDENT_TEMPORARY_MESSAGE =
  '认证材料暂时无法读取，请稍后重试；如持续出现，请重新提交或联系平台处理。'

const AUDIENCE_MESSAGES = {
  admin: {
    STORAGE_OBJECT_NOT_FOUND: '该认证材料当前无法读取，请联系学生重新提交。',
    STORAGE_UNAVAILABLE: ADMIN_TEMPORARY_MESSAGE,
  },
  student: {
    STORAGE_OBJECT_NOT_FOUND: '该认证材料当前无法读取，请重新提交或联系平台处理。',
    STORAGE_UNAVAILABLE: STUDENT_TEMPORARY_MESSAGE,
  },
}

function temporaryMessage(audience) {
  return audience === 'admin' ? ADMIN_TEMPORARY_MESSAGE : STUDENT_TEMPORARY_MESSAGE
}

export function certificationMaterialErrorMessage(error, audience) {
  const code = error?.response?.data?.error?.code
  const codeMessage = AUDIENCE_MESSAGES[audience]?.[code]
  if (codeMessage) return codeMessage

  const status = error?.response?.status
  if (status === 403) return '你没有权限查看该认证材料。'
  if (status === 404) return '该认证材料不存在或已被删除。'
  if (status >= 500 || !error?.response) return temporaryMessage(audience)

  return apiErrorMessage(error, temporaryMessage(audience))
}

export async function tryOpenCertificationMaterial(openMaterial, id, audience) {
  try {
    await openMaterial(id, audience)
    return ''
  } catch (error) {
    return certificationMaterialErrorMessage(error, audience)
  }
}
