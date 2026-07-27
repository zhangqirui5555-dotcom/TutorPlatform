import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  getMyCertifications,
  openCertificationMaterial,
  uploadCertification,
} from '../api/certification.js'

const STATUS_LABELS = {
  APPROVED: '已通过',
  NOT_SUBMITTED: '未提交',
  PENDING: '审核中',
  REJECTED: '已拒绝',
}

function StudentCertificationPage() {
  const [result, setResult] = useState({ current_status: 'NOT_SUBMITTED', history: [] })
  const [file, setFile] = useState(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const loadCertifications = useCallback(async () => {
    try {
      setResult(await getMyCertifications())
    } catch {
      setError('认证状态加载失败，请稍后重试。')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadCertifications()
  }, [loadCertifications])

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setSuccess('')

    if (!file) {
      setError('请选择 JPG、PNG 或 PDF 材料。')
      return
    }
    if (file.size > 1024 * 1024) {
      setError('文件不能超过 1MB。')
      return
    }

    setIsSubmitting(true)
    try {
      await uploadCertification(file)
      setFile(null)
      setSuccess('认证材料已提交，请等待管理员审核。')
      await loadCertifications()
    } catch (requestError) {
      setError(
        requestError.response?.data?.error?.message ||
          '认证材料提交失败，请检查文件格式和大小。',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  const canSubmit = !['PENDING', 'APPROVED'].includes(result.current_status)

  return (
    <section className="application-workspace">
      <header className="workspace-header">
        <div>
          <p className="eyebrow">Student · Certification</p>
          <h1>学生认证</h1>
          <p>上传学生证、在读证明或其他学校认证材料。</p>
        </div>
        <Link className="secondary-link-button" to="/student/profile">返回个人资料</Link>
      </header>

      {error && <div className="notice notice-error" role="alert">{error}</div>}
      {success && <div className="notice notice-success" role="status">{success}</div>}

      {isLoading ? (
        <div className="empty-state">正在加载认证状态…</div>
      ) : (
        <>
          <div className="welcome-panel">
            <div>
              <h2>当前状态：{STATUS_LABELS[result.current_status] || result.current_status}</h2>
              <p>认证通过后即可向家教需求投递申请。</p>
            </div>
          </div>

          {canSubmit && (
            <form className="demand-form-card certification-form" onSubmit={handleSubmit}>
              <label>
                <span>认证材料（JPG、PNG、PDF，最大 1MB）</span>
                <input
                  accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf"
                  onChange={(event) => setFile(event.target.files?.[0] || null)}
                  required
                  type="file"
                />
              </label>
              <button className="primary-button" disabled={isSubmitting} type="submit">
                {isSubmitting ? '正在上传…' : '提交认证'}
              </button>
            </form>
          )}

          {result.history.length > 0 && (
            <div className="demand-list certification-history">
              {result.history.map((item) => (
                <article className="demand-card" key={item.id}>
                  <div>
                    <h2>{STATUS_LABELS[item.status] || item.status}</h2>
                    <p>{new Date(item.submitted_at).toLocaleString('zh-CN')}</p>
                    {item.rejection_reason && <p>拒绝原因：{item.rejection_reason}</p>}
                  </div>
                  <button
                    className="secondary-button compact-button"
                    onClick={() => openCertificationMaterial(item.id, 'student')}
                    type="button"
                  >
                    查看材料
                  </button>
                </article>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  )
}

export default StudentCertificationPage

