import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  closeGovernanceDemand,
  getGovernanceOverview,
  reopenGovernanceDemand,
} from '../api/admin.js'
import EmptyState from '../components/EmptyState.jsx'
import ErrorAlert from '../components/ErrorAlert.jsx'
import LoadingState from '../components/LoadingState.jsx'

const STATUS_LABELS = {
  DRAFT: '草稿',
  RECRUITING: '招募中',
  MATCHED: '已匹配',
  COMPLETED: '已完成',
  CLOSED: '已关闭',
}

function AdminGovernancePage() {
  const [overview, setOverview] = useState(null)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [updatingId, setUpdatingId] = useState(null)

  const loadOverview = useCallback(async () => {
    setError('')
    try {
      setOverview(await getGovernanceOverview())
    } catch (requestError) {
      setError(requestError.response?.data?.error?.message || '平台数据加载失败。')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadOverview()
  }, [loadOverview])

  async function closeDemand(demand) {
    if (!window.confirm(`确认关闭需求“${demand.title}”吗？关闭后学生将无法继续投递。`)) {
      return
    }

    setUpdatingId(demand.id)
    setError('')
    try {
      await closeGovernanceDemand(demand.id)
      await loadOverview()
    } catch (requestError) {
      setError(requestError.response?.data?.error?.message || '需求关闭失败。')
    } finally {
      setUpdatingId(null)
    }
  }

  async function reopenDemand(demand) {
    if (!window.confirm(`确认恢复需求“${demand.title}”吗？恢复后将重新允许学生浏览和投递。`)) {
      return
    }

    setUpdatingId(demand.id)
    setError('')
    try {
      await reopenGovernanceDemand(demand.id)
      await loadOverview()
    } catch (requestError) {
      setError(requestError.response?.data?.error?.message || '需求恢复失败。')
    } finally {
      setUpdatingId(null)
    }
  }

  const metrics = overview?.metrics

  return (
    <section className="admin-workspace">
      <header className="workspace-header">
        <div>
          <p className="eyebrow">Admin · Governance</p>
          <h1>平台治理</h1>
          <p>查看关键业务数据，并维护公开家教需求的正常秩序。</p>
        </div>
        <Link className="secondary-link-button" to="/admin/dashboard">返回控制台</Link>
      </header>

      <ErrorAlert message={error} onRetry={loadOverview} />

      {isLoading ? (
        <LoadingState label="正在加载平台数据…" />
      ) : !overview ? (
        <EmptyState
          title="平台数据暂时不可用"
          description="后端服务可能仍在部署，请稍后点击上方重试。"
        />
      ) : (
        <>
          <div className="metric-grid">
            <article><span>平台用户</span><strong>{metrics.total_users}</strong><small>{metrics.active_users} 个正常账号</small></article>
            <article><span>家长 / 学生</span><strong>{metrics.parents} / {metrics.students}</strong><small>{metrics.suspended_users} 个停用账号</small></article>
            <article><span>招募中需求</span><strong>{metrics.recruiting_demands}</strong><small>{metrics.matched_demands} 个已匹配</small></article>
            <article><span>累计投递</span><strong>{metrics.applications}</strong><small>{metrics.active_conversations} 个活跃会话</small></article>
            <article><span>待审认证</span><strong>{metrics.pending_certifications}</strong><small>{metrics.completed_demands} 个需求已完成</small></article>
          </div>

          <section className="governance-section">
            <div className="section-heading">
              <div><h2>需求内容管理</h2><p>最多显示最近 50 条需求。</p></div>
              <button className="secondary-button compact-button" onClick={loadOverview} type="button">刷新数据</button>
            </div>
            {overview.demands.length === 0 ? (
              <EmptyState title="暂无家教需求" description="家长发布需求后会显示在这里。" />
            ) : (
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead><tr><th>需求</th><th>发布者</th><th>地区</th><th>投递</th><th>状态</th><th>治理操作</th></tr></thead>
                  <tbody>
                    {overview.demands.map((demand) => (
                      <tr key={demand.id}>
                        <td><strong>{demand.title}</strong><small>{demand.subject}</small></td>
                        <td><strong>{demand.parent.display_name}</strong><small>{demand.parent.email}</small></td>
                        <td>{demand.region}</td>
                        <td>{demand.application_count}</td>
                        <td><span className={`status-tag status-${demand.status.toLowerCase()}`}>{STATUS_LABELS[demand.status] || demand.status}</span></td>
                        <td>
                          {['DRAFT', 'RECRUITING'].includes(demand.status) ? (
                            <button
                              className="secondary-button compact-button danger-button"
                              disabled={updatingId === demand.id}
                              onClick={() => closeDemand(demand)}
                              type="button"
                            >
                              {updatingId === demand.id ? '处理中…' : '关闭需求'}
                            </button>
                          ) : demand.status === 'CLOSED' ? (
                            <button
                              className="secondary-button compact-button"
                              disabled={updatingId === demand.id}
                              onClick={() => reopenDemand(demand)}
                              type="button"
                            >
                              {updatingId === demand.id ? '处理中…' : '恢复需求'}
                            </button>
                          ) : <span className="muted-text">无需处理</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </section>
  )
}

export default AdminGovernancePage
