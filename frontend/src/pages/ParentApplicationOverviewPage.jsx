import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getMyDemands } from '../api/demand.js'

const STATUS_LABELS = {
  CLOSED: '已关闭',
  COMPLETED: '已完成',
  DRAFT: '草稿',
  MATCHED: '已匹配',
  RECRUITING: '招募中',
}

function ParentApplicationOverviewPage() {
  const [demands, setDemands] = useState([])
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let active = true

    getMyDemands()
      .then((items) => {
        if (active) setDemands(items)
      })
      .catch((requestError) => {
        if (active) {
          setError(
            requestError.response?.data?.error?.message ||
              '需求列表加载失败，请稍后重试。',
          )
        }
      })
      .finally(() => {
        if (active) setIsLoading(false)
      })

    return () => {
      active = false
    }
  }, [])

  return (
    <section className="application-workspace">
      <header className="workspace-header">
        <div>
          <p className="eyebrow">Parent · Applications</p>
          <h1>投递筛选</h1>
          <p>选择一条家教需求，查看学生简历并接受或拒绝投递。</p>
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
        <div className="empty-state">正在加载需求…</div>
      ) : demands.length === 0 ? (
        <div className="empty-state">
          <h2>还没有可管理的需求</h2>
          <p>请先创建并发布家教需求，再等待大学生投递。</p>
          <Link to="/parent/demands/create">创建需求</Link>
        </div>
      ) : (
        <div className="demand-list">
          {demands.map((demand) => {
            const canViewApplications = ['RECRUITING', 'MATCHED', 'COMPLETED'].includes(
              demand.status,
            )

            return (
              <article className="demand-card" key={demand.id}>
                <div className="demand-card-main">
                  <div className="demand-title-row">
                    <h2>{demand.title}</h2>
                    <span className={`status-tag status-${demand.status.toLowerCase()}`}>
                      {STATUS_LABELS[demand.status] || demand.status}
                    </span>
                  </div>
                  <dl className="demand-meta">
                    <div>
                      <dt>科目</dt>
                      <dd>{demand.subject}</dd>
                    </div>
                    <div>
                      <dt>年级</dt>
                      <dd>{demand.child_grade}</dd>
                    </div>
                    <div>
                      <dt>区域</dt>
                      <dd>{demand.region}</dd>
                    </div>
                  </dl>
                </div>

                <div className="demand-actions">
                  {canViewApplications ? (
                    <Link
                      className="primary-link-button compact-button"
                      to={`/parent/demands/${demand.id}/applications`}
                    >
                      查看学生投递
                    </Link>
                  ) : (
                    <span className="muted-action">
                      {demand.status === 'DRAFT' ? '发布后可查看投递' : '当前状态不可筛选'}
                    </span>
                  )}
                </div>
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}

export default ParentApplicationOverviewPage
