import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { createApplication } from '../api/application.js'
import { getDemandDetail } from '../api/studentDemand.js'

function formatBudget(min, max) {
  const formatter = new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: 'CNY',
    maximumFractionDigits: 2,
  })
  return `${formatter.format(min / 100)} – ${formatter.format(max / 100)}/小时`
}

function StudentDemandDetailPage() {
  const { id } = useParams()
  const [demand, setDemand] = useState(null)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [coverMessage, setCoverMessage] = useState('')
  const [applicationError, setApplicationError] = useState('')
  const [applicationSuccess, setApplicationSuccess] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    let isActive = true

    async function loadDetail() {
      try {
        const detail = await getDemandDetail(id)
        if (isActive) {
          setDemand(detail)
          setError('')
        }
      } catch (requestError) {
        if (isActive) {
          setDemand(null)
          setError(
            requestError.response?.data?.error?.message ||
              '需求详情加载失败，请返回需求大厅重试。',
          )
        }
      } finally {
        if (isActive) {
          setIsLoading(false)
        }
      }
    }

    loadDetail()
    return () => {
      isActive = false
    }
  }, [id])

  async function handleApplication(event) {
    event.preventDefault()
    setApplicationError('')
    setIsSubmitting(true)

    try {
      await createApplication(id, coverMessage)
      setApplicationSuccess(true)
      setCoverMessage('')
    } catch (requestError) {
      setApplicationError(
        requestError.response?.data?.error?.message ||
          '申请提交失败，请检查认证状态或稍后重试。',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading) {
    return <div className="empty-state">正在加载需求详情…</div>
  }

  if (!demand) {
    return (
      <section className="detail-error">
        <h1>无法加载需求</h1>
        <p>{error}</p>
        <Link to="/student/demands">返回需求大厅</Link>
      </section>
    )
  }

  return (
    <section className="demand-detail-card">
      <header>
        <div>
          <p className="eyebrow">Demand detail</p>
          <h1>{demand.title}</h1>
        </div>
        <Link to="/student/demands">返回大厅</Link>
      </header>

      <div className="detail-status-row">
        <span>{demand.subject}</span>
        <small>招募中</small>
      </div>

      <dl className="detail-grid">
        <div>
          <dt>孩子年级</dt>
          <dd>{demand.child_grade}</dd>
        </div>
        <div>
          <dt>授课区域</dt>
          <dd>{demand.region}</dd>
        </div>
        <div>
          <dt>预算范围</dt>
          <dd>{formatBudget(demand.budget_min, demand.budget_max)}</dd>
        </div>
        <div>
          <dt>期望时间</dt>
          <dd>{demand.schedule_description}</dd>
        </div>
      </dl>

      <div className="detail-description">
        <h2>需求说明</h2>
        <p>{demand.description || '家长暂未填写补充说明。'}</p>
      </div>

      <div className="application-panel">
        <h2>申请这份家教</h2>
        <p>用简短的自荐语介绍你的优势和教学经验。</p>

        {applicationSuccess ? (
          <div className="notice notice-success" role="status">
            申请已提交。你可以在<Link to="/student/applications">我的投递</Link>中查看状态。
          </div>
        ) : (
          <form onSubmit={handleApplication}>
            {applicationError && (
              <div className="notice notice-error" role="alert">
                {applicationError}
              </div>
            )}
            <label>
              <span>自荐语</span>
              <textarea
                onChange={(event) => setCoverMessage(event.target.value)}
                placeholder="例如：我有两年初中数学辅导经验，擅长梳理知识点……"
                required
                rows="5"
                value={coverMessage}
              />
            </label>
            <button className="primary-button" disabled={isSubmitting} type="submit">
              {isSubmitting ? '正在提交…' : '立即申请'}
            </button>
          </form>
        )}
      </div>
    </section>
  )
}

export default StudentDemandDetailPage
