import { Link } from 'react-router-dom'
import { formatBudget } from '../utils/publicDemandFormat.js'

function formatDate(value) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date)
}

function PublicDemandCard({ demand }) {
  const publishedAt = formatDate(demand.published_at)
  const expiresAt = formatDate(demand.expires_at)

  return (
    <article className="public-demand-card">
      <header className="public-demand-card__header">
        <div className="public-demand-card__labels">
          <span>{demand.subject}</span>
          {demand.is_featured && (
            <span className="public-demand-card__featured">推荐</span>
          )}
        </div>
        <h3>{demand.title}</h3>
      </header>

      <dl className="public-demand-card__meta">
        <div><dt>年级</dt><dd>{demand.child_grade}</dd></div>
        <div><dt>区域</dt><dd>{demand.region}</dd></div>
        <div><dt>预算</dt><dd>{formatBudget(demand)}</dd></div>
        <div><dt>时间</dt><dd>{demand.schedule_description}</dd></div>
      </dl>

      {demand.public_summary && (
        <p className="public-demand-card__summary">{demand.public_summary}</p>
      )}

      <footer className="public-demand-card__footer">
        <div>
          {publishedAt && <span>发布于 {publishedAt}</span>}
          {expiresAt && <span>有效至 {expiresAt}</span>}
        </div>
        <Link to={`/demands/${demand.id}`}>查看详情</Link>
      </footer>
    </article>
  )
}

export default PublicDemandCard
