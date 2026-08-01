import { useCallback, useEffect, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { getPublicDemandDetail } from '../api/publicDemand.js'
import EmptyState from '../components/EmptyState.jsx'
import ErrorAlert from '../components/ErrorAlert.jsx'
import LoadingState from '../components/LoadingState.jsx'
import { getToken, getUser } from '../utils/auth.js'
import { formatBudget } from '../utils/publicDemandFormat.js'
import '../styles/homeDemand.css'

function formatDateTime(value) {
  if (!value) return '长期有效'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '以平台信息为准'
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date)
}

function RoleAction({ demandId }) {
  const location = useLocation()
  const user = getUser()
  const isAuthenticated = Boolean(getToken() && user)

  if (!isAuthenticated) {
    return (
      <div className="public-demand-detail__action">
        <Link
          className="primary-link-button"
          state={{ from: location.pathname }}
          to="/login"
        >
          登录后申请
        </Link>
        <p>登录后将返回当前公开需求页，再按账号角色继续操作。</p>
      </div>
    )
  }

  if (user.role === 'STUDENT') {
    return (
      <div className="public-demand-detail__action">
        <Link className="primary-link-button" to={`/student/demands/${demandId}`}>
          进入学生端查看并申请
        </Link>
        <p>实际投递将在学生端完成，并继续执行认证与权限校验。</p>
      </div>
    )
  }

  if (user.role === 'PARENT') {
    return (
      <div className="public-demand-detail__action">
        <p className="public-demand-detail__role-note">家长账号不能投递需求。</p>
        <Link className="secondary-link-button" to="/parent/dashboard">
          返回家长控制台
        </Link>
      </div>
    )
  }

  if (user.role === 'ADMIN') {
    return (
      <div className="public-demand-detail__action">
        <Link className="secondary-link-button" to="/admin/governance">
          进入管理后台
        </Link>
      </div>
    )
  }

  return null
}

function PublicDemandDetailPage() {
  const { id } = useParams()
  const [demand, setDemand] = useState(null)
  const [error, setError] = useState(null)
  const [isLoading, setIsLoading] = useState(true)

  const loadDemand = useCallback(async () => {
    setError(null)
    setIsLoading(true)
    try {
      setDemand(await getPublicDemandDetail(id))
    } catch (requestError) {
      setDemand(null)
      setError(requestError)
    } finally {
      setIsLoading(false)
    }
  }, [id])

  useEffect(() => {
    loadDemand()
  }, [loadDemand])

  if (isLoading) {
    return (
      <section className="public-demand-detail-page">
        <LoadingState label="正在加载公开需求…" />
      </section>
    )
  }

  if (error?.status === 404) {
    return (
      <section className="public-demand-detail-page">
        <EmptyState
          action={<Link className="secondary-link-button" to="/">返回首页</Link>}
          description="该需求可能尚未公开、已经关闭、已经过期，或发布账号当前不可用。"
          title="公开需求不存在"
        />
      </section>
    )
  }

  if (error || !demand) {
    return (
      <section className="public-demand-detail-page">
        <ErrorAlert message={error?.message || '需求详情暂时无法加载。'} onRetry={loadDemand} />
        <Link className="secondary-link-button" to="/">返回首页</Link>
      </section>
    )
  }

  return (
    <section className="public-demand-detail-page">
      <header className="public-demand-detail__header">
        <div>
          <p className="eyebrow">Public demand</p>
          <div className="public-demand-detail__labels">
            <span>{demand.subject}</span>
            {demand.is_featured && <span>推荐</span>}
          </div>
          <h1>{demand.title}</h1>
          <p>本页面仅展示经过平台筛选的公开信息，不包含家长联系方式或详细地址。</p>
        </div>
        <Link className="secondary-link-button" to="/">返回首页</Link>
      </header>

      <div className="public-demand-detail__content">
        <dl className="public-demand-detail__grid">
          <div><dt>学生年级</dt><dd>{demand.child_grade}</dd></div>
          <div><dt>辅导科目</dt><dd>{demand.subject}</dd></div>
          <div><dt>授课区域</dt><dd>{demand.region}</dd></div>
          <div><dt>预算范围</dt><dd>{formatBudget(demand)}</dd></div>
          <div><dt>期望时间</dt><dd>{demand.schedule_description}</dd></div>
          <div><dt>有效期至</dt><dd>{formatDateTime(demand.expires_at)}</dd></div>
        </dl>

        {demand.public_summary && (
          <section className="public-demand-detail__summary">
            <h2>公开需求摘要</h2>
            <p>{demand.public_summary}</p>
          </section>
        )}

        <RoleAction demandId={demand.id} />
      </div>
    </section>
  )
}

export default PublicDemandDetailPage
