import { useCallback, useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
  closeDemand,
  getMyDemands,
  publishDemand,
} from '../api/demand.js'

const STATUS_LABELS = {
  CLOSED: '已关闭',
  COMPLETED: '已完成',
  DRAFT: '草稿',
  MATCHED: '已匹配',
  RECRUITING: '招募中',
}

function formatBudget(min, max) {
  const formatter = new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: 'CNY',
    maximumFractionDigits: 2,
  })
  return `${formatter.format(min / 100)} – ${formatter.format(max / 100)}/小时`
}

function getErrorMessage(error, fallback) {
  return error.response?.data?.error?.message || fallback
}

function ParentDemandPage() {
  const location = useLocation()
  const [demands, setDemands] = useState([])
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [updatingId, setUpdatingId] = useState(null)

  const loadDemands = useCallback(async () => {
    setError('')
    setIsLoading(true)

    try {
      setDemands(await getMyDemands())
    } catch (requestError) {
      setError(getErrorMessage(requestError, '需求加载失败，请稍后重试。'))
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadDemands()
  }, [loadDemands])

  async function updateDemand(demandId, action) {
    setError('')
    setUpdatingId(demandId)

    try {
      const updated =
        action === 'publish'
          ? await publishDemand(demandId)
          : await closeDemand(demandId)
      setDemands((current) =>
        current.map((demand) => (demand.id === updated.id ? updated : demand)),
      )
    } catch (requestError) {
      setError(getErrorMessage(requestError, '需求状态更新失败，请稍后重试。'))
    } finally {
      setUpdatingId(null)
    }
  }

  return (
    <section className="demand-workspace">
      <header className="workspace-header">
        <div>
          <p className="eyebrow">Parent · Demands</p>
          <h1>我的家教需求</h1>
          <p>创建需求草稿，发布后等待合适的大学生投递。</p>
        </div>
        <Link className="primary-link-button" to="/parent/demands/create">
          创建需求
        </Link>
      </header>

      {location.state?.created && (
        <div className="notice notice-success" role="status">
          需求已创建，并保存为草稿。
        </div>
      )}

      {error && (
        <div className="notice notice-error" role="alert">
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="empty-state">正在加载需求…</div>
      ) : demands.length === 0 ? (
        <div className="empty-state">
          <h2>还没有需求</h2>
          <p>创建第一条需求，开始寻找合适的大学生家教。</p>
          <Link to="/parent/demands/create">立即创建</Link>
        </div>
      ) : (
        <div className="demand-list">
          {demands.map((demand) => (
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
                    <dt>区域</dt>
                    <dd>{demand.region}</dd>
                  </div>
                  <div>
                    <dt>预算</dt>
                    <dd>{formatBudget(demand.budget_min, demand.budget_max)}</dd>
                  </div>
                </dl>
              </div>

              <div className="demand-actions">
                {['RECRUITING', 'MATCHED'].includes(demand.status) && (
                  <Link
                    className="secondary-link-button compact-button"
                    to={`/parent/demands/${demand.id}/applications`}
                  >
                    查看投递
                  </Link>
                )}
                {demand.status === 'DRAFT' && (
                  <button
                    className="primary-button compact-button"
                    disabled={updatingId === demand.id}
                    onClick={() => updateDemand(demand.id, 'publish')}
                    type="button"
                  >
                    {updatingId === demand.id ? '处理中…' : '发布'}
                  </button>
                )}
                {demand.status === 'RECRUITING' && (
                  <button
                    className="secondary-button compact-button"
                    disabled={updatingId === demand.id}
                    onClick={() => updateDemand(demand.id, 'close')}
                    type="button"
                  >
                    {updatingId === demand.id ? '处理中…' : '关闭'}
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}

export default ParentDemandPage
