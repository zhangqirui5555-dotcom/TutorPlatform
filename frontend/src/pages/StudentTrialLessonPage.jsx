import { useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { getMyApplications } from '../api/application.js'
import {
  createTrialLesson,
  getTrialLessons,
} from '../api/trialLesson.js'
import TrialLessonCard from '../components/TrialLessonCard.jsx'
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
  const [acceptedApplications, setAcceptedApplications] = useState([])
  const [form, setForm] = useState(INITIAL_FORM)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const loadData = useCallback(async () => {
    setError('')

    try {
      const [trialResult, applicationResult] = await Promise.all([
        getTrialLessons(),
        getMyApplications(),
      ])
      setTrialLessons(trialResult)
      const accepted = applicationResult.filter(
        (application) => application.status === 'ACCEPTED',
      )
      setAcceptedApplications(accepted)
      setForm((current) => ({
        ...current,
        application_id: current.application_id || String(accepted[0]?.id || ''),
      }))
    } catch (requestError) {
      setError(
        requestError.response?.data?.error?.message ||
          '试课预约加载失败，请稍后重试。',
      )
    } finally {
      setIsLoading(false)
    }
  }, [])

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

    const start = new Date(form.scheduled_start_at)
    const end = new Date(form.scheduled_end_at)

    if (end <= start) {
      setError('结束时间必须晚于开始时间。')
      return
    }

    setIsSubmitting(true)

    try {
      await createTrialLesson(form.application_id, {
        scheduled_start_at: start.toISOString(),
        scheduled_end_at: end.toISOString(),
        method: form.method,
        location_or_link: form.location_or_link,
      })
      setForm((current) => ({
        ...INITIAL_FORM,
        application_id: current.application_id,
      }))
      await loadData()
    } catch (requestError) {
      setError(
        requestError.response?.data?.error?.message ||
          '预约创建失败，请检查时间和投递状态。',
      )
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

      <section className="trial-create-panel">
        <h2>创建预约</h2>
        {acceptedApplications.length === 0 ? (
          <p>
            暂无可预约的已接受投递。请先在<Link to="/student/applications">我的投递</Link>
            中确认撮合状态。
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
                {acceptedApplications.map((application) => (
                  <option key={application.id} value={application.id}>
                    {application.demand?.title || `投递 #${application.id}`}
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
