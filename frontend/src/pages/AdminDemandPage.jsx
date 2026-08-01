import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getAdminDemands, updateDemandExpiry, updateDemandFeature, updateDemandVisibility } from '../api/admin.js'
import AdminDemandFilter from '../components/AdminDemandFilter.jsx'
import AdminDemandLogPanel from '../components/AdminDemandLogPanel.jsx'
import AdminDemandOperations from '../components/AdminDemandOperations.jsx'
import EmptyState from '../components/EmptyState.jsx'
import ErrorAlert from '../components/ErrorAlert.jsx'
import LoadingState from '../components/LoadingState.jsx'
import '../styles/adminDemand.css'

const EMPTY_FILTERS = { search: '', status: '', visibility_status: '', is_featured: '', subject: '', region: '', expired: '' }
const STATUS = { DRAFT: '草稿', RECRUITING: '招募中', MATCHED: '已匹配', COMPLETED: '已完成', CLOSED: '已关闭' }
const formatDate = (value) => value ? new Date(value).toLocaleString('zh-CN') : '—'
const messageFor = (error) => {
  const status = error.response?.status
  const backend = error.response?.data?.error?.message || error.response?.data?.message
  if (status === 404) return backend || '需求不存在或已被删除。'
  if (status === 409) return backend || '当前需求状态不允许执行该操作。'
  if (status === 403) return '你没有需求运营权限。'
  return backend || error.message || '请求失败，请稍后重试。'
}

function AdminDemandPage() {
  const [filters, setFilters] = useState(EMPTY_FILTERS); const [applied, setApplied] = useState(EMPTY_FILTERS); const [page, setPage] = useState(1)
  const [demands, setDemands] = useState([]); const [pagination, setPagination] = useState({ total_pages: 1, total: 0 }); const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [success, setSuccess] = useState(''); const [logDemand, setLogDemand] = useState(null)
  const load = useCallback(async () => { setLoading(true); setError(''); try { const params = { page, page_size: 20 }; Object.entries(applied).forEach(([key, value]) => { if (value !== '') params[key] = value }); const data = await getAdminDemands(params); setDemands(data.demands); setPagination(data.pagination) } catch (err) { setError(messageFor(err)) } finally { setLoading(false) } }, [applied, page])
  useEffect(() => { load() }, [load])
  const submitFilters = (e) => { e.preventDefault(); setPage(1); setApplied({ ...filters }) }
  const reset = () => { setFilters({ ...EMPTY_FILTERS }); setPage(1); setApplied({ ...EMPTY_FILTERS }) }
  async function operate(demand, action, data) {
    setSuccess('')
    try {
      if (action === 'list' || action === 'unlist') await updateDemandVisibility(demand.id, data)
      else if (action === 'feature' || action === 'unfeature') await updateDemandFeature(demand.id, data)
      else await updateDemandExpiry(demand.id, data)
      setSuccess(`“${demand.title}”操作成功。`); await load()
    } catch (err) { throw new Error(messageFor(err)) }
  }

  return <section className="page-section admin-demand-page"><div className="section-heading admin-demand-heading"><div><span className="eyebrow">Admin · Demands</span><h1>需求运营</h1><p>审核公开信息，控制需求上架、推荐与有效期。</p></div><Link className="secondary-button" to="/admin/dashboard">返回控制台</Link></div>
    <AdminDemandFilter filters={filters} onChange={setFilters} onReset={reset} onSubmit={submitFilters} />
    {success && <div className="notice notice-success" role="status">{success}</div>}
    <ErrorAlert message={error} onRetry={load} />
    {loading ? <LoadingState label="正在加载需求…" /> : !error && !demands.length ? <EmptyState description="请调整筛选条件后重试。" title="没有符合条件的需求" /> : !error && <div className="admin-demand-table-wrap"><table className="admin-demand-table"><thead><tr><th>需求</th><th>状态</th><th>运营信息</th><th>家长 / 投递</th><th>操作</th></tr></thead><tbody>{demands.map((demand) => <tr key={demand.id}><td data-label="需求"><strong>{demand.title}</strong><span>{demand.child_grade} · {demand.subject}</span><span>{demand.region}</span><small>ID: {demand.id}</small></td><td data-label="状态"><span>{STATUS[demand.status] || demand.status}</span><span className={`status-chip ${demand.visibility_status === 'VISIBLE' ? 'is-visible' : ''}`}>{demand.visibility_status === 'VISIBLE' ? '已上架' : '已下架'}</span>{demand.is_featured && <span className="status-chip is-featured">推荐</span>}</td><td data-label="运营信息"><span>权重：{demand.sort_weight}</span><span>有效期：{formatDate(demand.expires_at)}</span><span>推荐：{formatDate(demand.featured_at)} 至 {formatDate(demand.featured_until)}</span><span>浏览：{demand.view_count} · 更新：{formatDate(demand.updated_at)}</span></td><td data-label="家长 / 投递"><strong>{demand.parent?.display_name || '—'}</strong><span>{demand.parent?.email || '—'}</span><span>账号：{demand.parent?.status || '—'}</span><span>投递：{demand.application_count}</span></td><td data-label="操作"><AdminDemandOperations demand={demand} onSubmit={(action, data) => operate(demand, action, data)} /><button className="log-button" onClick={() => setLogDemand(demand)} type="button">查看操作日志</button></td></tr>)}</tbody></table></div>}
    {!loading && !error && pagination.total_pages > 1 && <div className="pagination"><button disabled={page <= 1} onClick={() => setPage(page - 1)} type="button">上一页</button><span>第 {page} / {pagination.total_pages} 页，共 {pagination.total} 条</span><button disabled={page >= pagination.total_pages} onClick={() => setPage(page + 1)} type="button">下一页</button></div>}
    {logDemand && <AdminDemandLogPanel demand={logDemand} onClose={() => setLogDemand(null)} />}
  </section>
}

export default AdminDemandPage
