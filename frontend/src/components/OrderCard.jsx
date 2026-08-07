import { Link } from 'react-router-dom'
import {
  formatDateTime,
  formatMoney,
  formatOrderStatus,
  formatPlatformFee,
  maskEmail,
  maskName,
} from '../utils/orderFormat.js'

function nextStep(order, role) {
  if (order.status === 'PENDING') {
    return role === 'PARENT' ? '确认服务金额' : '等待家长确认服务金额'
  }
  if (order.status === 'CONFIRMED') {
    return role === 'STUDENT' ? '确认订单' : '等待学生确认'
  }
  if (order.status === 'IN_PROGRESS') {
    return role === 'PARENT' ? '完成试课后确认服务完成' : '沟通并完成试课'
  }
  if (order.status === 'COMPLETED') return '查看试课与评价'
  return '查看取消信息'
}

function participantSummary(order, role) {
  if (role === 'PARENT') {
    return {
      label: '学生',
      name: order.student?.display_name || `学生 #${order.student_id}`,
      detail: order.student?.email || '暂无公开邮箱',
    }
  }

  if (role === 'STUDENT') {
    return {
      label: '家长',
      name: maskName(order.parent?.display_name),
      detail: maskEmail(order.parent?.email) || '联系方式已保护',
    }
  }

  return {
    label: '参与双方',
    name: `${order.parent?.display_name || `家长 #${order.parent_id}`} / ${order.student?.display_name || `学生 #${order.student_id}`}`,
    detail: `${order.parent?.email || '—'} · ${order.student?.email || '—'}`,
  }
}

function OrderCard({ order, role }) {
  const participant = participantSummary(order, role)
  const rolePath = role.toLowerCase()

  return (
    <article className="order-card">
      <header className="order-card__header">
        <div>
          <span className="order-card__id">订单 #{order.id}</span>
          <h2>{order.demand?.title || `需求 #${order.demand_id}`}</h2>
        </div>
        <span className={`order-status order-status--${order.status.toLowerCase()}`}>
          {formatOrderStatus(order.status)}
        </span>
      </header>

      <div className="order-card__money">
        <div>
          <span>服务金额</span>
          <strong>{formatMoney(order.total_amount, order.currency)}</strong>
        </div>
        <div>
          <span>平台服务费</span>
          <strong>{formatPlatformFee(order.platform_fee, order.currency)}</strong>
        </div>
      </div>

      <dl className="order-card__details">
        <div>
          <dt>{participant.label}</dt>
          <dd>
            <strong>{participant.name}</strong>
            <small>{participant.detail}</small>
          </dd>
        </div>
        <div>
          <dt>创建时间</dt>
          <dd>{formatDateTime(order.created_at)}</dd>
        </div>
        <div>
          <dt>下一步</dt>
          <dd>{nextStep(order, role)}</dd>
        </div>
      </dl>

      <footer className="order-card__footer">
        <Link className="primary-link-button" to={`/${rolePath}/orders/${order.id}`}>
          查看订单详情
        </Link>
      </footer>
    </article>
  )
}

export default OrderCard
