import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  approveCertification,
  getPendingCertifications,
  openCertificationMaterial,
  rejectCertification,
} from '../api/certification.js'

function AdminCertificationPage() {
  const [items, setItems] = useState([])
  const [reasons, setReasons] = useState({})
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [updatingId, setUpdatingId] = useState(null)

  const loadItems = useCallback(async () => {
    setError('')
    try {
      setItems(await getPendingCertifications())
    } catch {
      setError('待审核认证加载失败。')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadItems()
  }, [loadItems])

  async function decide(item, decision) {
    if (decision === 'reject' && !reasons[item.id]?.trim()) {
      setError('拒绝认证时必须填写原因。')
      return
    }

    setUpdatingId(item.id)
    setError('')
    try {
      if (decision === 'approve') {
        await approveCertification(item.id)
      } else {
        await rejectCertification(item.id, reasons[item.id])
      }
      await loadItems()
    } catch (requestError) {
      setError(requestError.response?.data?.error?.message || '认证审核失败。')
    } finally {
      setUpdatingId(null)
    }
  }

  return (
    <section className="application-workspace">
      <header className="workspace-header">
        <div>
          <p className="eyebrow">Admin · Certification</p>
          <h1>学生认证审核</h1>
          <p>查看大学生提交的证明材料，并作出审核决定。</p>
        </div>
        <Link className="secondary-link-button" to="/admin/dashboard">返回控制台</Link>
      </header>

      {error && <div className="notice notice-error" role="alert">{error}</div>}

      {isLoading ? (
        <div className="empty-state">正在加载待审核认证…</div>
      ) : items.length === 0 ? (
        <div className="empty-state">
          <h2>暂无待审核认证</h2>
          <p>学生提交材料后会显示在这里。</p>
        </div>
      ) : (
        <div className="candidate-grid">
          {items.map((item) => (
            <article className="candidate-card" key={item.id}>
              <header>
                <div>
                  <h2>{item.student?.display_name || '大学生'}</h2>
                  <p>
                    {item.student?.profile?.school || '学校未填写'} ·{' '}
                    {item.student?.profile?.major || '专业未填写'}
                  </p>
                </div>
                <span className="status-tag status-pending">待审核</span>
              </header>
              <button
                className="secondary-button compact-button"
                onClick={() => openCertificationMaterial(item.id, 'admin')}
                type="button"
              >
                打开认证材料
              </button>
              <label>
                <span>拒绝原因</span>
                <input
                  onChange={(event) =>
                    setReasons((current) => ({ ...current, [item.id]: event.target.value }))
                  }
                  placeholder="仅拒绝时填写"
                  value={reasons[item.id] || ''}
                />
              </label>
              <div className="candidate-actions">
                <button
                  className="secondary-button compact-button"
                  disabled={updatingId === item.id}
                  onClick={() => decide(item, 'reject')}
                  type="button"
                >
                  拒绝
                </button>
                <button
                  className="primary-button compact-button"
                  disabled={updatingId === item.id}
                  onClick={() => decide(item, 'approve')}
                  type="button"
                >
                  {updatingId === item.id ? '处理中…' : '通过'}
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}

export default AdminCertificationPage

