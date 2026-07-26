import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { createReview, getMyReviews } from '../api/review.js'
import { getTrialLessons } from '../api/trialLesson.js'
import { getUser } from '../utils/auth.js'
import EmptyState from './EmptyState.jsx'
import ErrorAlert from './ErrorAlert.jsx'
import LoadingState from './LoadingState.jsx'

const INITIAL_FORM = { rating: '5', content: '' }

function formatDate(value) {
  if (!value) return '时间待确认'
  return new Intl.DateTimeFormat('zh-CN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

function ReviewCard({ review, mode }) {
  const person = mode === 'received' ? review.reviewer : review.reviewee

  return (
    <article className="review-card">
      <header>
        <div>
          <strong>{person?.display_name || `用户 #${person?.id || ''}`}</strong>
          <p>{review.trial_lesson?.demand?.title || '试课评价'}</p>
        </div>
        <span aria-label={`${review.rating} 星`} className="review-stars">
          {'★'.repeat(review.rating)}
          <i>{'★'.repeat(5 - review.rating)}</i>
        </span>
      </header>
      <p className="review-content">{review.content || '对方未填写文字评价。'}</p>
      <time>{formatDate(review.created_at)}</time>
    </article>
  )
}

function ReviewWorkspace({ role }) {
  const user = getUser()
  const dashboardPath =
    role === 'STUDENT' ? '/student/dashboard' : '/parent/dashboard'
  const trialPath =
    role === 'STUDENT' ? '/student/trial-lessons' : '/parent/trial-lessons'
  const [reviews, setReviews] = useState({ sent: [], received: [] })
  const [trialLessons, setTrialLessons] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [form, setForm] = useState(INITIAL_FORM)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const loadData = useCallback(async () => {
    setError('')
    try {
      const [reviewResult, trialResult] = await Promise.all([
        getMyReviews(),
        getTrialLessons(),
      ])
      setReviews({
        sent: reviewResult.sent || [],
        received: reviewResult.received || [],
      })
      setTrialLessons(trialResult || [])
    } catch (requestError) {
      setError(
        requestError.response?.data?.error?.message ||
          '评价数据加载失败，请稍后重试。',
      )
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const pendingTrials = useMemo(() => {
    const reviewedIds = new Set(
      reviews.sent.map((review) => review.trial_lesson_id),
    )
    return trialLessons.filter(
      (trial) =>
        trial.status === 'COMPLETED' && !reviewedIds.has(trial.id),
    )
  }, [reviews.sent, trialLessons])

  function otherParticipant(trial) {
    return Number(user?.id) === trial.parent_id ? trial.student : trial.parent
  }

  async function handleSubmit(event, trialLessonId) {
    event.preventDefault()
    setError('')
    setSuccess('')
    const rating = Number(form.rating)

    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      setError('评分必须是 1 到 5 的整数。')
      return
    }

    setIsSubmitting(true)
    try {
      await createReview(trialLessonId, {
        rating,
        content: form.content.trim(),
      })
      setSelectedId(null)
      setForm(INITIAL_FORM)
      setSuccess('评价提交成功。')
      await loadData()
    } catch (requestError) {
      const code = requestError.response?.data?.error?.code
      setError(
        code === 'REVIEW_ALREADY_EXISTS'
          ? '你已经评价过本次试课，不能重复评价。'
          : requestError.response?.data?.error?.message ||
              '评价提交失败，请稍后重试。',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section className="review-workspace">
      <header className="workspace-header">
        <div>
          <p className="eyebrow">{role === 'STUDENT' ? 'Student' : 'Parent'} · Reviews</p>
          <h1>我的评价</h1>
          <p>完成试课后评价对方，并查看双方留下的反馈。</p>
        </div>
        <Link className="secondary-link-button" to={dashboardPath}>
          返回控制台
        </Link>
      </header>

      <ErrorAlert message={error} onRetry={loadData} />
      {success && <div className="notice notice-success" role="status">{success}</div>}

      <section className="review-section">
        <div className="review-section-heading">
          <div>
            <p className="eyebrow">To review</p>
            <h2>待评价试课</h2>
          </div>
          <Link to={trialPath}>查看全部预约</Link>
        </div>
        {isLoading ? (
          <LoadingState label="正在加载评价…" />
        ) : pendingTrials.length === 0 ? (
          <EmptyState
            description="完成试课后，评价入口会显示在这里。"
            title="暂无待评价试课"
          />
        ) : (
          <div className="review-grid">
            {pendingTrials.map((trial) => {
              const other = otherParticipant(trial)
              const isOpen = selectedId === trial.id
              return (
                <article className="review-entry-card" key={trial.id}>
                  <div>
                    <span className="status-pill status-completed">已完成</span>
                    <h3>{trial.demand?.title || `试课 #${trial.id}`}</h3>
                    <p>评价对象：{other?.display_name || `用户 #${other?.id}`}</p>
                    <time>{formatDate(trial.scheduled_start_at)}</time>
                  </div>
                  {!isOpen ? (
                    <button
                      className="primary-button"
                      onClick={() => {
                        setSelectedId(trial.id)
                        setForm(INITIAL_FORM)
                        setError('')
                      }}
                      type="button"
                    >
                      立即评价
                    </button>
                  ) : (
                    <form
                      className="review-form"
                      onSubmit={(event) => handleSubmit(event, trial.id)}
                    >
                      <label>
                        <span>评分</span>
                        <select
                          onChange={(event) =>
                            setForm((current) => ({
                              ...current,
                              rating: event.target.value,
                            }))
                          }
                          value={form.rating}
                        >
                          {[5, 4, 3, 2, 1].map((rating) => (
                            <option key={rating} value={rating}>
                              {rating} 星
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        <span>评价内容</span>
                        <textarea
                          maxLength="1000"
                          onChange={(event) =>
                            setForm((current) => ({
                              ...current,
                              content: event.target.value,
                            }))
                          }
                          placeholder="分享本次试课体验（选填）"
                          rows="4"
                          value={form.content}
                        />
                      </label>
                      <div className="review-form-actions">
                        <button
                          className="secondary-button"
                          onClick={() => setSelectedId(null)}
                          type="button"
                        >
                          取消
                        </button>
                        <button
                          className="primary-button"
                          disabled={isSubmitting}
                          type="submit"
                        >
                          {isSubmitting ? '提交中…' : '提交评价'}
                        </button>
                      </div>
                    </form>
                  )}
                </article>
              )
            })}
          </div>
        )}
      </section>

      <div className="review-columns">
        <section className="review-section">
          <div className="review-section-heading">
            <div><p className="eyebrow">Received</p><h2>收到的评价</h2></div>
            <span>{reviews.received.length} 条</span>
          </div>
          {reviews.received.length === 0 ? (
            <div className="empty-state">暂未收到评价。</div>
          ) : (
            <div className="review-list">
              {reviews.received.map((review) => (
                <ReviewCard key={review.id} mode="received" review={review} />
              ))}
            </div>
          )}
        </section>
        <section className="review-section">
          <div className="review-section-heading">
            <div><p className="eyebrow">Sent</p><h2>发出的评价</h2></div>
            <span>{reviews.sent.length} 条</span>
          </div>
          {reviews.sent.length === 0 ? (
            <div className="empty-state">暂未发出评价。</div>
          ) : (
            <div className="review-list">
              {reviews.sent.map((review) => (
                <ReviewCard key={review.id} mode="sent" review={review} />
              ))}
            </div>
          )}
        </section>
      </div>
    </section>
  )
}

export default ReviewWorkspace
