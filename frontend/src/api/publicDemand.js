import client from './client.js'
import { apiErrorMessage } from '../utils/apiError.js'

function publicDemandError(error, fallbackMessage) {
  const apiError = new Error(apiErrorMessage(error, fallbackMessage))
  apiError.code = error.response?.data?.error?.code
  apiError.status = error.response?.status
  return apiError
}

export async function getPublicDemands(params = {}) {
  try {
    const response = await client.get('/public/demands', { params })
    return response.data
  } catch (error) {
    throw publicDemandError(error, '最新家教需求加载失败，请稍后重试。')
  }
}

export async function getFeaturedDemands(params = {}) {
  try {
    const response = await client.get('/public/demands/featured', { params })
    return response.data
  } catch (error) {
    throw publicDemandError(error, '推荐家教需求加载失败，请稍后重试。')
  }
}

export async function getPublicDemandDetail(id) {
  try {
    const response = await client.get(`/public/demands/${id}`)
    return response.data.demand
  } catch (error) {
    throw publicDemandError(error, '家教需求详情加载失败，请稍后重试。')
  }
}
