import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  acceptApplication,
  getDemandApplications,
  rejectApplication,
} from '../api/application.js'
import { getConversations } from '../api/conversation.js'
import { getOrders } from '../api/order.js'
import { getUserReviews } from '../api/review.js'
import MatchSuccessDialog from '../components/MatchSuccessDialog.jsx'
import StudentTrustProfile from '../components/StudentTrustProfile.jsx'
import {
  applicationResourceMap,
  matchFlowPaths,
  resourcesFromAcceptResult,
} from '../utils/matchFlow.js'
import '../styles/matchFlow.css'

const STATUS_LABELS = {
  ACCEPTED: '已匹配',
  PENDING: '待查看',
  REJECTED: '未选择',
  VIEWED: '已查看',
}

function ParentApplicationPage() {
  const { id } = useParams()
  const [applications, setApplications] = useState([])
  const [studentReviews, setStudentReviews] = useState({})
  const [studentReviewStates, setStudentReviewStates] = useState({})
  const [applicationResources, setApplicationResources] = useState({})
  const [matchResult, setMatchResult] = useState(null)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [updatingId, setUpdatingId] = useState(null)
  const reviewRequestRef = useRef(0)
  const resourceRequestRef = useRef(0)

  const loadAcceptedResources = useCallback(async (items) => {
    const requestId = resourceRequestRef.current + 1
    resourceRequestRef.current = requestId

    if (!items.some((application) => application.status === 'ACCEPTED')) {
      setApplicationResources({})
      return
    }

    const [ordersResult, conversationsResult] = await Promise.allSettled([
      getOrders({ page: 1, page_size: 50 }),
      getConversations(),
    ])
    if (resourceRequestRef.current !== requestId) return

    const orders = ordersResult.status === 'fulfilled'
      ? ordersResult.value.orders || []
      : []
    const conversations = conversationsResult.status === 'fulfilled'
      ? conversationsResult.value || []
      : []
    setApplicationResources(applicationResourceMap(items, orders, conversations))
  }, [])

  const loadApplications = useCallback(async () => {
    setError('')

    try {
      const items = await getDemandApplications(id)
      const studentIds = [...new Set(
        items.map((application) => application.student?.id).filter(Boolean),
      )]
      const requestId = reviewRequestRef.current + 1
      const loadingStates = Object.fromEntries(
        studentIds.map((studentId) => [studentId, 'loading']),
      )

      reviewRequestRef.current = requestId
      setApplications(items)
      setStudentReviews({})
      setStudentReviewStates(loadingStates)
      void loadAcceptedResources(items)

      void Promise.all(
        studentIds.map(async (studentId) => {
          try {
            const reviews = await getUserReviews(studentId)
            return [studentId, { reviews, state: 'ready' }]
          } catch {
            return [studentId, { reviews: [], state: 'unavailable' }]
          }
        }),
      ).then((results) => {
        if (reviewRequestRef.current !== requestId) return

        setStudentReviews(Object.fromEntries(
          results.map(([studentId, result]) => [studentId, result.reviews]),
        ))
        setStudentReviewStates(Object.fromEntries(
          results.map(([studentId, result]) => [studentId, result.state]),
        ))
      })
    } catch (requestError) {
      setError(
        requestError.response?.data?.error?.message ||
          '申请列表加载失败，请稍后重试。',
      )
    } finally {
      setIsLoading(false)
    }
  }, [id, loadAcceptedResources])

  useEffect(() => {
    loadApplications()
  }, [loadApplications])

  async function handleDecision(applicationId, decision) {
    if (updatingId) return

    setUpdatingId(applicationId)
    setError('')

    try {
      if (decision === 'accept') {
        const result = await acceptApplication(applicationId)
        const resources = resourcesFromAcceptResult(result)
        setApplicationResources((current) => ({
          ...current,
          [applicationId]: resources,
        }))
        setMatchResult(result)
      } else {
        await rejectApplication(applicationId)
      }
      await loadApplications()
    } catch (requestError) {
      setError(
        requestError.response?.data?.error?.message ||
          '申请处理失败，请稍后重试。',
      )
    } finally {
      setUpdatingId(null)
    }
  }

  return (
    <>
      <section className="application-workspace">
      <header className="workspace-header">
        <div>
          <p className="eyebrow">Parent · Applications</p>
          <h1>收到的学生申请</h1>
          <p>查看学生资料和自荐语，并作出筛选决定。</p>
        </div>
        <Link className="secondary-link-button" to="/parent/demands">
          返回需求列表
        </Link>
      </header>

      {error && (
        <div className="notice notice-error" role="alert">
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="empty-state">正在加载学生申请…</div>
      ) : applications.length === 0 ? (
        <div className="empty-state">
          <h2>暂时没有申请</h2>
          <p>需求发布后，学生投递会显示在这里。</p>
        </div>
      ) : (
        <div className="candidate-grid">
          {applications.map((application) => {
            const profile = application.student?.profile
            const studentId = application.student?.id
            const canDecide = ['PENDING', 'VIEWED'].includes(application.status)
            const paths = matchFlowPaths(applicationResources[application.id], 'PARENT')

            return (
              <article className="candidate-card" key={application.id}>
                <header>
                  <div className="candidate-avatar">
                    {application.student?.display_name?.slice(0, 1) || '学'}
                  </div>
                  <div>
                    <h2>{application.student?.display_name || '大学生申请者'}</h2>
                    <p>
                      {profile?.school || '学校未填写'} · {profile?.major || '专业未填写'}
                    </p>
                  </div>
                  <span
                    className={`status-tag status-${application.status.toLowerCase()}`}
                  >
                    {STATUS_LABELS[application.status] || application.status}
                  </span>
                </header>

                <div className="cover-message">
                  <span>自荐语</span>
                  <p>{application.cover_message}</p>
                </div>

                <StudentTrustProfile
                  reviews={studentReviews[studentId] || []}
                  reviewState={studentReviewStates[studentId] || 'idle'}
                  student={application.student}
                />

                {application.status === 'ACCEPTED' && (
                  <div className="application-outcome application-outcome--matched">
                    <strong>已匹配</strong>
                    <p>双方现在可以确认订单、开始沟通并安排试课。</p>
                    <div className="application-outcome__actions">
                      <Link className="secondary-link-button" to={paths.order}>查看订单</Link>
                      <Link className="secondary-link-button" to={paths.messages}>联系学生</Link>
                      <Link className="secondary-link-button" to={paths.trials}>查看试课</Link>
                    </div>
                  </div>
                )}

                {application.status === 'REJECTED' && (
                  <div className="application-outcome application-outcome--not-selected">
                    <strong>本次未选择</strong>
                    <p>该申请已处理，无需继续操作。</p>
                  </div>
                )}

                {canDecide && (
                  <div className="candidate-actions">
                    <button
                      className="secondary-button compact-button"
                      disabled={updatingId !== null}
                      onClick={() => handleDecision(application.id, 'reject')}
                      type="button"
                    >
                      拒绝
                    </button>
                    <button
                      className="primary-button compact-button"
                      disabled={updatingId !== null}
                      onClick={() => handleDecision(application.id, 'accept')}
                      type="button"
                    >
                      {updatingId === application.id ? '处理中…' : '接受'}
                    </button>
                  </div>
                )}
              </article>
            )
          })}
        </div>
      )}
      </section>

      <MatchSuccessDialog
        matchResult={matchResult}
        onClose={() => setMatchResult(null)}
      />
    </>
  )
}

export default ParentApplicationPage
