const STATUS_LABELS = {
  CANCELLED: '已取消',
  COMPLETED: '已完成',
  CONFIRMED: '已确认',
  PENDING_CONFIRMATION: '待确认',
}

const METHOD_LABELS = {
  OFFLINE: '线下试课',
  ONLINE: '线上试课',
}

function formatDateTime(value) {
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function TrialLessonCard({ trialLesson, actions }) {
  return (
    <article className="trial-card">
      <header>
        <div>
          <span>{trialLesson.demand?.subject}</span>
          <h2>{trialLesson.demand?.title || `试课 #${trialLesson.id}`}</h2>
        </div>
        <span className={`status-tag status-${trialLesson.status.toLowerCase()}`}>
          {STATUS_LABELS[trialLesson.status] || trialLesson.status}
        </span>
      </header>

      <dl className="trial-meta">
        <div>
          <dt>开始时间</dt>
          <dd>{formatDateTime(trialLesson.scheduled_start_at)}</dd>
        </div>
        <div>
          <dt>结束时间</dt>
          <dd>{formatDateTime(trialLesson.scheduled_end_at)}</dd>
        </div>
        <div>
          <dt>试课方式</dt>
          <dd>{METHOD_LABELS[trialLesson.method] || trialLesson.method}</dd>
        </div>
        <div>
          <dt>地点 / 链接</dt>
          <dd>{trialLesson.location_or_link || '待双方沟通'}</dd>
        </div>
      </dl>

      {trialLesson.cancellation_reason && (
        <p className="cancellation-note">
          取消原因：{trialLesson.cancellation_reason}
        </p>
      )}

      {actions && <div className="trial-actions">{actions}</div>}
    </article>
  )
}

export default TrialLessonCard
