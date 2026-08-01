import AdminDemandOperations from './AdminDemandOperations.jsx'

const STATUS_LABELS = {
  DRAFT: '草稿',
  RECRUITING: '招募中',
  MATCHED: '已匹配',
  COMPLETED: '已完成',
  CLOSED: '已关闭',
}

const formatDate = (value) => value ? new Date(value).toLocaleString('zh-CN') : '—'

function Field({ label, children }) {
  return <div className="admin-demand-card__field"><dt>{label}</dt><dd>{children}</dd></div>
}

function AdminDemandCard({ demand, onOpenLogs, onOperate }) {
  return (
    <article className="admin-demand-card">
      <header className="admin-demand-card__header">
        <div>
          <span className="admin-demand-card__id">需求 ID：{demand.id}</span>
          <h2>{demand.title}</h2>
        </div>
        <span className={`status-chip ${demand.visibility_status === 'VISIBLE' ? 'is-visible' : ''}`}>
          {demand.visibility_status === 'VISIBLE' ? '已上架' : '已下架'}
        </span>
      </header>

      <dl className="admin-demand-card__details">
        <Field label="科目">{demand.subject}</Field>
        <Field label="年级">{demand.child_grade}</Field>
        <Field label="区域">{demand.region}</Field>
        <Field label="业务状态">{STATUS_LABELS[demand.status] || demand.status}</Field>
        <Field label="公开状态">{demand.visibility_status === 'VISIBLE' ? '已上架' : '已下架'}</Field>
        <Field label="是否推荐">{demand.is_featured ? '是' : '否'}</Field>
        <Field label="有效期">{formatDate(demand.expires_at)}</Field>
        <Field label="家长状态">{demand.parent?.status || '—'}</Field>
        <Field label="投递数量">{demand.application_count}</Field>
      </dl>

      <div className="admin-demand-card__operations">
        <AdminDemandOperations
          demand={demand}
          onSubmit={(action, data) => onOperate(demand, action, data)}
        />
        <button className="log-button" onClick={() => onOpenLogs(demand)} type="button">
          查看操作日志
        </button>
      </div>
    </article>
  )
}

export default AdminDemandCard
