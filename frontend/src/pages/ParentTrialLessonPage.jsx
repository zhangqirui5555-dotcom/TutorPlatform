import { useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  cancelTrialLesson,
  completeTrialLesson,
  confirmTrialLesson,
  getTrialLessons,
} from '../api/trialLesson.js'
import TrialLessonCard from '../components/TrialLessonCard.jsx'
import { resolveTrialLessonTarget } from '../utils/trialLessonFocus.js'

function ParentTrialLessonPage() {
  const [searchParams] = useSearchParams()
  const [trialLessons, setTrialLessons] = useState([])
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [updatingId, setUpdatingId] = useState(null)

  const loadTrialLessons = useCallback(async () => {
    setError('')

    try {
      setTrialLessons(await getTrialLessons())
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
    loadTrialLessons()
  }, [loadTrialLessons])

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

  async function updateStatus(trialLessonId, action) {
    setUpdatingId(trialLessonId)
    setError('')

    try {
      if (action === 'confirm') {
        await confirmTrialLesson(trialLessonId)
      } else if (action === 'cancel') {
        await cancelTrialLesson(trialLessonId)
      } else {
        await completeTrialLesson(trialLessonId)
      }
      await loadTrialLessons()
    } catch (requestError) {
      setError(
        requestError.response?.data?.error?.message ||
          '预约状态更新失败，请稍后重试。',
      )
    } finally {
      setUpdatingId(null)
    }
  }

  return (
    <section className="trial-workspace">
      <header className="workspace-header">
        <div>
          <p className="eyebrow">家长端 · 试课</p>
          <h1>试课预约管理</h1>
          <p>确认学生发起的时间，或完成、取消已有试课。</p>
        </div>
        <Link className="secondary-link-button" to="/parent/dashboard">
          返回控制台
        </Link>
      </header>

      {error && (
        <div className="notice notice-error" role="alert">
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="empty-state">正在加载预约…</div>
      ) : trialLessons.length === 0 ? (
        <div className="empty-state">暂无试课预约。</div>
      ) : (
        <div className="trial-grid">
          {trialLessons.map((trialLesson) => {
            const isUpdating = updatingId === trialLesson.id
            let actions = null

            if (trialLesson.status === 'PENDING_CONFIRMATION') {
              actions = (
                <>
                  <button
                    className="secondary-button compact-button"
                    disabled={isUpdating}
                    onClick={() => updateStatus(trialLesson.id, 'cancel')}
                    type="button"
                  >
                    取消
                  </button>
                  <button
                    className="primary-button compact-button"
                    disabled={isUpdating}
                    onClick={() => updateStatus(trialLesson.id, 'confirm')}
                    type="button"
                  >
                    {isUpdating ? '处理中…' : '确认'}
                  </button>
                </>
              )
            } else if (trialLesson.status === 'CONFIRMED') {
              actions = (
                <>
                  <button
                    className="secondary-button compact-button"
                    disabled={isUpdating}
                    onClick={() => updateStatus(trialLesson.id, 'cancel')}
                    type="button"
                  >
                    取消
                  </button>
                  <button
                    className="primary-button compact-button"
                    disabled={isUpdating}
                    onClick={() => updateStatus(trialLesson.id, 'complete')}
                    type="button"
                  >
                    {isUpdating ? '处理中…' : '完成试课'}
                  </button>
                </>
              )
            }

            return (
              <TrialLessonCard
                actions={actions}
                highlighted={focusedTrialLessonId === trialLesson.id}
                key={trialLesson.id}
                trialLesson={trialLesson}
              />
            )
          })}
        </div>
      )}
    </section>
  )
}

export default ParentTrialLessonPage
