import AdminDemandOperations from './AdminDemandOperations.jsx'
import {
  adminDemandPublicStatusLabel,
  adminDemandStatusLabel,
  isAdminDemandEffectivelyFeatured,
  isAdminDemandPubliclyVisible,
} from '../utils/adminDemandOperations.js'

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
        <span className={`status-chip ${isAdminDemandPubliclyVisible(demand) ? 'is-visible' : ''}`}>
          {adminDemandPublicStatusLabel(demand)}
        </span>
      </header>

      <dl className="admin-demand-card__details">
        <Field label="科目">{demand.subject}</Field>
        <Field label="年级">{demand.child_grade}</Field>
        <Field label="区域">{demand.region}</Field>
        <Field label="业务状态">{adminDemandStatusLabel(demand.status)}</Field>
        <Field label="公开状态">{adminDemandPublicStatusLabel(demand)}</Field>
        <Field label="是否推荐">{isAdminDemandEffectivelyFeatured(demand) ? '是' : '否'}</Field>
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
