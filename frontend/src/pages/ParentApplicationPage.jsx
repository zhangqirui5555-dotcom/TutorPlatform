import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  acceptApplication,
  getDemandApplications,
  rejectApplication,
} from '../api/application.js'

const STATUS_LABELS = {
  ACCEPTED: '已接受',
  PENDING: '待查看',
  REJECTED: '已拒绝',
  VIEWED: '已查看',
}

function ParentApplicationPage() {
  const { id } = useParams()
  const [applications, setApplications] = useState([])
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [updatingId, setUpdatingId] = useState(null)

  const loadApplications = useCallback(async () => {
    setError('')

    try {
      setApplications(await getDemandApplications(id))
    } catch (requestError) {
      setError(
        requestError.response?.data?.error?.message ||
          '申请列表加载失败，请稍后重试。',
      )
    } finally {
      setIsLoading(false)
    }
  }, [id])

  useEffect(() => {
    loadApplications()
  }, [loadApplications])

  async function handleDecision(applicationId, decision) {
    setUpdatingId(applicationId)
    setError('')

    try {
      if (decision === 'accept') {
        await acceptApplication(applicationId)
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
            const canDecide = ['PENDING', 'VIEWED'].includes(application.status)

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

                {canDecide && (
                  <div className="candidate-actions">
                    <button
                      className="secondary-button compact-button"
                      disabled={updatingId === application.id}
                      onClick={() => handleDecision(application.id, 'reject')}
                      type="button"
                    >
                      拒绝
                    </button>
                    <button
                      className="primary-button compact-button"
                      disabled={updatingId === application.id}
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
  )
}

export default ParentApplicationPage
