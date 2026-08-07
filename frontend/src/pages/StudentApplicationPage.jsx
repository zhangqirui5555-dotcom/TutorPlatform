import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getMyApplications } from '../api/application.js'
import { getOrders } from '../api/order.js'
import { applicationResourceMap, matchFlowPaths } from '../utils/matchFlow.js'
import '../styles/matchFlow.css'

const STATUS_LABELS = {
  ACCEPTED: '匹配成功',
  PENDING: '待查看',
  REJECTED: '未选择',
  VIEWED: '已查看',
}

function StudentApplicationPage() {
  const [applications, setApplications] = useState([])
  const [applicationResources, setApplicationResources] = useState({})
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let isActive = true

    async function loadApplications() {
      try {
        const result = await getMyApplications()
        if (isActive) {
          setApplications(result)
        }

        if (result.some((application) => application.status === 'ACCEPTED')) {
          try {
            const orderResult = await getOrders({ page: 1, page_size: 50 })
            if (isActive) {
              setApplicationResources(applicationResourceMap(
                result,
                orderResult.orders || [],
                [],
              ))
            }
          } catch {
            if (isActive) setApplicationResources(applicationResourceMap(result))
          }
        }
      } catch (requestError) {
        if (isActive) {
          setError(
            requestError.response?.data?.error?.message ||
              '投递记录加载失败，请稍后重试。',
          )
        }
      } finally {
        if (isActive) {
          setIsLoading(false)
        }
      }
    }

    loadApplications()
    return () => {
      isActive = false
    }
  }, [])

  return (
    <section className="application-workspace">
      <header className="workspace-header">
        <div>
          <p className="eyebrow">Student · Applications</p>
          <h1>我的投递</h1>
          <p>查看家教申请的最新处理状态。</p>
        </div>
        <Link className="primary-link-button" to="/student/demands">
          浏览需求
        </Link>
      </header>

      {error && (
        <div className="notice notice-error" role="alert">
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="empty-state">正在加载投递记录…</div>
      ) : applications.length === 0 ? (
        <div className="empty-state">
          <h2>还没有投递</h2>
          <p>前往需求大厅，寻找适合自己的家教机会。</p>
          <Link to="/student/demands">浏览公开需求</Link>
        </div>
      ) : (
        <div className="application-list">
          {applications.map((application) => {
            const paths = matchFlowPaths(applicationResources[application.id], 'STUDENT')

            return (
              <article className="application-card" key={application.id}>
              <div className="application-card-header">
                <div>
                  <span>{application.demand?.subject}</span>
                  <h2>{application.demand?.title || `需求 #${application.demand_id}`}</h2>
                </div>
                <span
                  className={`status-tag status-${application.status.toLowerCase()}`}
                >
                  {STATUS_LABELS[application.status] || application.status}
                </span>
              </div>
              <div className="application-demand-meta">
                <span>{application.demand?.child_grade}</span>
                <span>{application.demand?.region}</span>
                <span>需求状态：{application.demand?.status}</span>
              </div>
              <blockquote>{application.cover_message}</blockquote>

              {application.status === 'ACCEPTED' && (
                <div className="application-outcome application-outcome--matched">
                  <strong>匹配成功</strong>
                  <p>家长已选择你，请查看订单并与家长沟通后续安排。</p>
                  <div className="application-outcome__actions">
                    <Link className="primary-link-button" to={paths.order}>查看订单</Link>
                  </div>
                </div>
              )}

              {application.status === 'REJECTED' && (
                <div className="application-outcome application-outcome--not-selected">
                  <strong>本次未选择</strong>
                  <p>可以继续看看其他合适的家教需求。</p>
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

export default StudentApplicationPage
