import { useState } from 'react'
import {
  adminDemandOperationAvailability,
  isAdminDemandOperationAllowed,
} from '../utils/adminDemandOperations.js'

const LABELS = { list: '上架', unlist: '下架', feature: '推荐', unfeature: '取消推荐', expiry: '调整有效期' }
const initial = { public_summary: '', expires_at: '', reason: '', sort_weight: '0', featured_at: '', featured_until: '' }
const iso = (value) => value ? new Date(value).toISOString() : undefined

function AdminDemandOperations({ demand, onSubmit }) {
  const [action, setAction] = useState('')
  const [form, setForm] = useState(initial)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const open = (value) => { setAction(value); setError(''); setForm({ ...initial, public_summary: demand.public_summary || '', expires_at: demand.expires_at ? demand.expires_at.slice(0, 16) : '' }) }
  const close = () => !busy && setAction('')
  const update = (e) => setForm({ ...form, [e.target.name]: e.target.value })

  async function submit(e) {
    e.preventDefault(); setError('')
    const now = Date.now()
    if (!isAdminDemandOperationAllowed(demand, action)) {
      return setError('当前需求状态已变化，请刷新后重试。')
    }
    if (!form.reason.trim()) return setError('请填写操作原因。')
    const data = { reason: form.reason.trim() }
    if (action === 'list') {
      if (!form.public_summary.trim() || form.public_summary.trim().length > 300) return setError('公开摘要必填，且不能超过 300 字。')
      if (form.expires_at && new Date(form.expires_at).getTime() <= now) return setError('有效期必须晚于当前时间。')
      Object.assign(data, { visibility_status: 'VISIBLE', public_summary: form.public_summary.trim(), expires_at: iso(form.expires_at) })
    } else if (action === 'unlist') data.visibility_status = 'HIDDEN'
    else if (action === 'feature') {
      const weight = Number(form.sort_weight)
      const start = form.featured_at ? new Date(form.featured_at) : new Date()
      const until = new Date(form.featured_until)
      if (!Number.isInteger(weight) || weight < 0 || weight > 10000) return setError('排序权重必须是 0–10000 的整数。')
      if (!form.featured_until || until <= start) return setError('推荐截止时间必须晚于推荐开始时间。')
      if (demand.expires_at && until > new Date(demand.expires_at)) return setError('推荐截止时间不能晚于需求有效期。')
      Object.assign(data, { is_featured: true, sort_weight: weight, featured_at: iso(form.featured_at), featured_until: until.toISOString() })
    } else if (action === 'unfeature') data.is_featured = false
    else {
      if (!form.expires_at || new Date(form.expires_at).getTime() <= now) return setError('请输入晚于当前时间的新有效期。')
      data.expires_at = iso(form.expires_at)
    }
    const warning = action === 'unlist' ? '下架会取消推荐，但不会删除需求、投递、聊天或历史数据。确认继续？' : action === 'expiry' ? '缩短有效期可能自动取消当前推荐。确认继续？' : `确认执行“${LABELS[action]}”操作？`
    if (!window.confirm(warning)) return
    setBusy(true)
    try { await onSubmit(action, data); setAction('') } catch (err) { setError(err.message) } finally { setBusy(false) }
  }

  const availability = adminDemandOperationAvailability(demand)

  return <>
    {(availability.canList
      || availability.canUnlist
      || availability.canFeature
      || availability.canUnfeature
      || availability.canAdjustExpiry) && <div className="admin-demand-actions">
      {availability.canList && <button onClick={() => open('list')} type="button">上架</button>}
      {availability.canUnlist && <button onClick={() => open('unlist')} type="button">下架</button>}
      {availability.canFeature && <button onClick={() => open('feature')} type="button">推荐</button>}
      {availability.canUnfeature && <button onClick={() => open('unfeature')} type="button">取消推荐</button>}
      {availability.canAdjustExpiry && <button onClick={() => open('expiry')} type="button">调整有效期</button>}
    </div>}
    {action && <div className="admin-demand-modal" onMouseDown={(e) => e.target === e.currentTarget && close()} role="presentation"><section aria-labelledby="operation-title" aria-modal="true" className="admin-demand-dialog" role="dialog"><div className="dialog-heading"><h2 id="operation-title">{LABELS[action]}需求</h2><button aria-label="关闭" onClick={close} type="button">×</button></div><form onSubmit={submit}>
      {action === 'list' && <><label>公开摘要（最多 300 字）<textarea maxLength="300" name="public_summary" onChange={update} required value={form.public_summary} /></label><label>有效期（不填则使用系统默认值）<input min={new Date().toISOString().slice(0,16)} name="expires_at" onChange={update} type="datetime-local" value={form.expires_at} /></label></>}
      {action === 'feature' && <><label>排序权重（0–10000）<input max="10000" min="0" name="sort_weight" onChange={update} required step="1" type="number" value={form.sort_weight} /></label><label>推荐开始时间（不填则立即开始）<input name="featured_at" onChange={update} type="datetime-local" value={form.featured_at} /></label><label>推荐截止时间<input name="featured_until" onChange={update} required type="datetime-local" value={form.featured_until} /></label></>}
      {action === 'expiry' && <label>新有效期<input name="expires_at" onChange={update} required type="datetime-local" value={form.expires_at} /></label>}
      <label>操作原因<textarea maxLength="300" name="reason" onChange={update} required value={form.reason} /></label>
      {error && <p className="field-error" role="alert">{error}</p>}<div className="dialog-actions"><button className="secondary-button" disabled={busy} onClick={close} type="button">取消</button><button className="primary-button" disabled={busy} type="submit">{busy ? '提交中…' : '确认提交'}</button></div>
    </form></section></div>}
  </>
}

export default AdminDemandOperations
