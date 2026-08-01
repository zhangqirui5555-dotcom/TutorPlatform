import { useCallback, useEffect, useState } from 'react'
import { getDemandOperationLogs } from '../api/admin.js'
import ErrorAlert from './ErrorAlert.jsx'
import LoadingState from './LoadingState.jsx'

const LABELS = { visibilityStatus: '公开状态', publicSummary: '公开摘要', isFeatured: '推荐状态', sortWeight: '排序权重', featuredAt: '推荐开始', featuredUntil: '推荐截止', expiresAt: '有效期', listedAt: '上架时间', unlistedAt: '下架时间', status: '业务状态' }
const ACTIONS = { DEMAND_LIST: '上架', DEMAND_UNLIST: '下架', DEMAND_FEATURE: '推荐', DEMAND_UNFEATURE: '取消推荐', DEMAND_EXPIRY_UPDATE: '调整有效期' }
const errorMessage = (error) => error.response?.data?.error?.message || error.response?.data?.message || error.message || '加载操作日志失败。'
const display = (key, value) => {
  if (value === null || value === undefined || value === '') return '无'
  if (typeof value === 'boolean') return value ? '是' : '否'
  if (/At$/.test(key)) return new Date(value).toLocaleString('zh-CN')
  return String(value)
}

function Changes({ before = {}, after = {} }) {
  const keys = [...new Set([...Object.keys(before || {}), ...Object.keys(after || {})])].filter((key) => key in LABELS && JSON.stringify(before?.[key]) !== JSON.stringify(after?.[key]))
  if (!keys.length) return <span>无运营字段变化</span>
  return <ul className="log-changes">{keys.map((key) => <li key={key}><strong>{LABELS[key]}：</strong>{display(key, before?.[key])} → {display(key, after?.[key])}</li>)}</ul>
}

function AdminDemandLogPanel({ demand, onClose }) {
  const [logs, setLogs] = useState([]); const [page, setPage] = useState(1); const [pagination, setPagination] = useState({ total_pages: 1 }); const [loading, setLoading] = useState(true); const [error, setError] = useState('')
  const load = useCallback(async () => { setLoading(true); setError(''); try { const data = await getDemandOperationLogs(demand.id, { page, page_size: 10 }); setLogs(data.logs); setPagination(data.pagination) } catch (err) { setError(errorMessage(err)) } finally { setLoading(false) } }, [demand.id, page])
  useEffect(() => { load() }, [load])
  return <div className="admin-demand-modal" role="presentation"><section aria-labelledby="log-title" aria-modal="true" className="admin-demand-dialog admin-demand-log-dialog" role="dialog"><div className="dialog-heading"><div><h2 id="log-title">操作日志</h2><p>{demand.title}</p></div><button aria-label="关闭" onClick={onClose} type="button">×</button></div>
    {loading ? <LoadingState label="正在加载操作日志…" /> : <><ErrorAlert message={error} onRetry={load} />{!error && !logs.length && <p className="empty-inline">暂无操作日志。</p>}{logs.map((log) => <article className="admin-demand-log" key={log.id}><header><strong>{ACTIONS[log.action] || log.action}</strong><time>{new Date(log.created_at).toLocaleString('zh-CN')}</time></header><p>管理员：{log.admin?.display_name || '未知管理员'}</p><p>原因：{log.reason || '未填写'}</p><Changes after={log.after_data} before={log.before_data} /></article>)}
      {!error && pagination.total_pages > 1 && <div className="pagination"><button disabled={page <= 1} onClick={() => setPage(page - 1)} type="button">上一页</button><span>第 {page} / {pagination.total_pages} 页</span><button disabled={page >= pagination.total_pages} onClick={() => setPage(page + 1)} type="button">下一页</button></div>}</>}
  </section></div>
}

export default AdminDemandLogPanel
