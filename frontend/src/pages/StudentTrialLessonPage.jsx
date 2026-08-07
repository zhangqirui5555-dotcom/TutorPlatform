import { useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { getMyApplications } from '../api/application.js'
import { getOrders } from '../api/order.js'
import {
  createTrialLesson,
  getTrialLessons,
} from '../api/trialLesson.js'
import TrialLessonCard from '../components/TrialLessonCard.jsx'
import {
  buildTrialLessonRequest,
  resolveTrialCreationApplicationId,
  trialCreationContexts,
  trialLessonErrorMessage,
} from '../utils/trialLessonCreate.js'
import { resolveTrialLessonTarget } from '../utils/trialLessonFocus.js'

const INITIAL_FORM = {
  application_id: '',
  scheduled_start_at: '',
  scheduled_end_at: '',
  method: 'ONLINE',
  location_or_link: '',
}

function StudentTrialLessonPage() {
  const [searchParams] = useSearchParams()
  const [trialLessons, setTrialLessons] = useState([])
  const [creationContexts, setCreationContexts] = useState([])
  const [form, setForm] = useState(INITIAL_FORM)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const requestedApplicationId = searchParams.get('application_id')
  const requestedOrderId = searchParams.get('order_id')

  const loadData = useCallback(async () => {
    setError('')

    try {
      const [trialResult, applicationResult, orderResult] = await Promise.all([
        getTrialLessons(),
        getMyApplications(),
        getOrders({ page: 1, page_size: 50 }),
      ])
      setTrialLessons(trialResult)
      const contexts = trialCreationContexts(
        applicationResult,
        orderResult.orders || [],
      )
      setCreationContexts(contexts)
      setForm((current) => ({
        ...current,
        application_id: resolveTrialCreationApplicationId(contexts, {
          applicationId: requestedApplicationId,
          orderId: requestedOrderId,
          currentApplicationId: current.application_id,
        }),
      }))
    } catch (requestError) {
      setError(trialLessonErrorMessage(
        requestError,
        '试课预约加载失败，请稍后重试。',
      ))
    } finally {
      setIsLoading(false)
    }
  }, [requestedApplicationId, requestedOrderId])

  useEffect(() => {
    loadData()
  }, [loadData])

  const focusedTrialLessonId = resolveTrialLessonTarget(
    searchParams.get('trial_lesson_id'),
    trialLessons,
  )

  useEffect(() => {
    if (!focusedTrialLessonId) return undefined

    const frame = window.requestAnimationFrame(() => {
      const card = document.getElementById(`trial-lesson-${focusedTrialLessonId}`)
      card?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      card?.focus({ preventScroll: true })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [focusedTrialLessonId])

  function updateField(event) {
    const { name, value } = event.target
    setForm((current) => ({ ...current, [name]: value }))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setSuccess('')

    let request
    try {
      request = buildTrialLessonRequest(form, creationContexts)
    } catch (validationError) {
      setError(validationError.message)
      return
    }

    setIsSubmitting(true)

    try {
      await createTrialLesson(request.applicationId, request.payload)
      setForm((current) => ({
        ...INITIAL_FORM,
        application_id: current.application_id,
      }))
      setSuccess('试课已创建。')
      await loadData()
    } catch (requestError) {
      setError(trialLessonErrorMessage(
        requestError,
        '预约创建失败，请检查时间和申请状态。',
      ))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section className="trial-workspace">
      <header className="workspace-header">
        <div>
          <p className="eyebrow">学生端 · 试课</p>
          <h1>我的试课预约</h1>
          <p>基于已接受的投递向家长发起试课时间建议。</p>
        </div>
        <Link className="secondary-link-button" to="/student/dashboard">
          返回控制台
        </Link>
      </header>

      {error && (
        <div className="notice notice-error" role="alert">
          {error}
        </div>
      )}
      {success && (
        <div className="notice notice-success" role="status">
          {success}
        </div>
      )}

      <section className="trial-create-panel">
        <h2>创建预约</h2>
        {creationContexts.length === 0 ? (
          <p>
            暂无可预约的已接受申请及关联订单。请先在
            <Link to="/student/applications">我的投递</Link>中确认撮合状态。
          </p>
        ) : (
          <form className="trial-form" onSubmit={handleSubmit}>
            <label className="full-field">
              <span>已接受的投递</span>
              <select
                name="application_id"
                onChange={updateField}
                required
                value={form.application_id}
              >
                {creationContexts.map((context) => (
                  <option key={context.orderId} value={context.applicationId}>
                    {context.application.demand?.title || `申请 #${context.applicationId}`}
                    {` · 订单 #${context.orderId}`}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>开始时间</span>
              <input
                name="scheduled_start_at"
                onChange={updateField}
                required
                type="datetime-local"
                value={form.scheduled_start_at}
              />
            </label>
            <label>
              <span>结束时间</span>
              <input
                name="scheduled_end_at"
                onChange={updateField}
                required
                type="datetime-local"
                value={form.scheduled_end_at}
              />
            </label>
            <label>
              <span>试课方式</span>
              <select name="method" onChange={updateField} value={form.method}>
                <option value="ONLINE">线上试课</option>
                <option value="OFFLINE">线下试课</option>
              </select>
            </label>
            <label>
              <span>地点或链接</span>
              <input
                name="location_or_link"
                onChange={updateField}
                placeholder="会议链接或线下地点"
                value={form.location_or_link}
              />
            </label>
            <div className="form-actions full-field">
              <button
                className="primary-button"
                disabled={isSubmitting}
                type="submit"
              >
                {isSubmitting ? '正在创建…' : '发起预约'}
              </button>
            </div>
          </form>
        )}
      </section>

      <h2 className="section-title">预约记录</h2>
      {isLoading ? (
        <div className="empty-state">正在加载预约…</div>
      ) : trialLessons.length === 0 ? (
        <div className="empty-state">暂无试课预约。</div>
      ) : (
        <div className="trial-grid">
          {trialLessons.map((trialLesson) => (
            <TrialLessonCard
              highlighted={focusedTrialLessonId === trialLesson.id}
              key={trialLesson.id}
              trialLesson={trialLesson}
            />
          ))}
        </div>
      )}
    </section>
  )
}

export default StudentTrialLessonPage
