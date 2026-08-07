import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  cancelOrder,
  completeOrder,
  confirmOrder,
  getOrder,
  updateOrderTerms,
} from '../api/order.js'
import ErrorAlert from '../components/ErrorAlert.jsx'
import LoadingState from '../components/LoadingState.jsx'
import OrderActionDialog from '../components/OrderActionDialog.jsx'
import {
  ORDER_STATUS,
  formatDateTime,
  formatMoney,
  formatOrderStatus,
  formatPlatformFee,
  maskEmail,
  maskName,
  orderNextStep,
  orderTimelineItems,
  orderErrorMessage,
  trialCompletionGuidance,
} from '../utils/orderFormat.js'
import '../styles/order.css'

const CANCELLABLE_STATUSES = new Set(['PENDING', 'CONFIRMED', 'IN_PROGRESS'])

function participant(order, role) {
  if (role === 'PARENT') {
    return {
      title: '学生信息',
      name: order.student?.display_name || `学生 #${order.student_id}`,
      email: order.student?.email || '暂无公开邮箱',
    }
  }
  if (role === 'STUDENT') {
    return {
      title: '家长信息',
      name: maskName(order.parent?.display_name),
      email: maskEmail(order.parent?.email) || '联系方式已保护',
    }
  }
  return null
}

function Timeline({ order }) {
  const items = orderTimelineItems(order)

  return (
    <ol className="order-timeline">
      {items.map((item) => (
        <li className="is-reached" key={item.label}>
          <span aria-hidden="true" />
          <div>
            <strong>{item.label}</strong>
            <time>{formatDateTime(item.value)}</time>
          </div>
        </li>
      ))}
    </ol>
  )
}

function TrialLessonSummary({ trialLesson }) {
  return (
    <li>
      <div>
        <strong>试课 #{trialLesson.id}</strong>
        <span>{formatDateTime(trialLesson.scheduled_start_at)}</span>
      </div>
      <span className={`trial-state trial-state--${trialLesson.status.toLowerCase()}`}>
        {trialLesson.status === 'COMPLETED' ? '已完成' : trialLesson.status === 'CANCELLED' ? '已取消' : trialLesson.status === 'CONFIRMED' ? '已确认' : '待确认'}
      </span>
    </li>
  )
}

function OrderDetailPage({ role }) {
  const { id } = useParams()
  const rolePath = role.toLowerCase()
  const [order, setOrder] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [dialog, setDialog] = useState('')
  const [actionError, setActionError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const loadOrder = useCallback(async () => {
    setError('')
    try {
      setOrder(await getOrder(id))
    } catch (requestError) {
      setError(orderErrorMessage(requestError, '订单详情加载失败，请稍后重试。'))
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    loadOrder()
  }, [loadOrder])

  const completionGuidance = useMemo(
    () => trialCompletionGuidance(order?.trial_lessons || []),
    [order],
  )
  const person = order ? participant(order, role) : null
  const conversationId = order?.application?.conversation_id
  const trialsPath = `/${rolePath}/trial-lessons`
  const messagesPath = conversationId
    ? `/${rolePath}/messages?conversation_id=${conversationId}`
    : `/${rolePath}/messages`
  const reviewsPath = `/${rolePath}/reviews`

  function openDialog(action) {
    setActionError('')
    setSuccess('')
    setDialog(action)
  }

  async function submitAction(payload) {
    if (submitting) return

    setSubmitting(true)
    setActionError('')
    try {
      if (dialog === 'terms') await updateOrderTerms(order.id, payload)
      if (dialog === 'confirm') await confirmOrder(order.id)
      if (dialog === 'complete') await completeOrder(order.id)
      if (dialog === 'cancel') {
        await cancelOrder(order.id, payload.cancellation_reason)
      }
      setSuccess('订单已更新。')
      setDialog('')
      await loadOrder()
    } catch (requestError) {
      setActionError(orderErrorMessage(requestError))
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <LoadingState label="正在加载订单详情…" />

  if (!order) {
    return (
      <section className="order-page">
        <ErrorAlert message={error || '订单不存在或已不可访问。'} onRetry={loadOrder} />
        <Link className="secondary-link-button" to={`/${rolePath}/orders`}>返回订单列表</Link>
      </section>
    )
  }

  return (
    <section className="order-page order-detail-page">
      <header className="workspace-header order-page__header">
        <div>
          <p className="eyebrow">
            {role === 'PARENT' ? '家长端' : role === 'STUDENT' ? '学生端' : '管理端'} · 订单 #{order.id}
          </p>
          <h1>{order.demand?.title || `订单 #${order.id}`}</h1>
          <p>{ORDER_STATUS[order.status]?.description}</p>
        </div>
        <Link className="secondary-link-button" to={`/${rolePath}/orders`}>
          返回订单列表
        </Link>
      </header>

      <ErrorAlert message={error} onRetry={loadOrder} />
      {success && <div className="notice notice-success" role="status">{success}</div>}

      <aside className="order-next-step" aria-label="当前下一步">
        <span>当前下一步</span>
        <strong>{orderNextStep(order.status)}</strong>
        {order.status === 'PENDING' && (
          <p>
            {role === 'PARENT'
              ? '订单已经建立，请先确认本次家教服务金额。'
              : '订单已经建立，正在等待家长确认本次家教服务金额。'}
          </p>
        )}
      </aside>

      <section className="order-hero-card">
        <div>
          <span>当前状态</span>
          <strong>{formatOrderStatus(order.status)}</strong>
        </div>
        <div>
          <span>服务金额</span>
          <strong>{formatMoney(order.total_amount, order.currency)}</strong>
        </div>
        <div>
          <span>平台服务费</span>
          <strong>{formatPlatformFee(order.platform_fee, order.currency)}</strong>
        </div>
      </section>

      {role === 'STUDENT' && order.status === 'CONFIRMED' && (
        <section className="order-confirm-guide">
          <div>
            <span>学生确认说明</span>
            <strong>确认服务金额与双方沟通结果一致</strong>
          </div>
          <p>学生确认后，订单将进入服务阶段，双方可以继续沟通并安排试课。</p>
        </section>
      )}

      {role !== 'ADMIN' && order.status === 'IN_PROGRESS' && (
        <section className="order-stage-guide">
          <div>
            <p className="eyebrow">当前阶段</p>
            <h2>服务进行中</h2>
          </div>
          <ol>
            <li>与对方确认授课安排</li>
            <li>完成至少一次试课</li>
            <li>家长确认服务完成</li>
          </ol>
          <div className="order-stage-guide__actions">
            <Link className="secondary-link-button" to={messagesPath}>进入聊天</Link>
            <Link className="secondary-link-button" to={trialsPath}>查看试课</Link>
          </div>
        </section>
      )}

      <div className="order-detail-grid">
        <section className="order-panel">
          <header><h2>订单与需求</h2></header>
          <dl className="order-info-list">
            <div><dt>订单ID</dt><dd>#{order.id}</dd></div>
            <div><dt>需求ID</dt><dd>#{order.demand_id}</dd></div>
            <div><dt>需求标题</dt><dd>{order.demand?.title || '—'}</dd></div>
            <div><dt>科目</dt><dd>{order.demand?.subject || '—'}</dd></div>
            <div><dt>地区</dt><dd>{order.demand?.region || '—'}</dd></div>
            <div><dt>币种</dt><dd>{order.currency === 'CNY' ? '人民币元' : order.currency}</dd></div>
          </dl>
        </section>

        {role === 'ADMIN' ? (
          <section className="order-panel">
            <header><h2>参与双方</h2></header>
            <dl className="order-info-list">
              <div><dt>家长</dt><dd>{order.parent?.display_name || `#${order.parent_id}`}<small>{order.parent?.email}</small></dd></div>
              <div><dt>学生</dt><dd>{order.student?.display_name || `#${order.student_id}`}<small>{order.student?.email}</small></dd></div>
            </dl>
          </section>
        ) : (
          <section className="order-panel">
            <header><h2>{person.title}</h2></header>
            <dl className="order-info-list">
              <div><dt>姓名</dt><dd>{person.name}</dd></div>
              <div><dt>邮箱</dt><dd>{person.email}</dd></div>
            </dl>
          </section>
        )}

        <section className="order-panel">
          <header><h2>状态时间线</h2></header>
          <Timeline order={order} />
          {order.cancellation_reason && (
            <div className="order-cancellation">
              <strong>取消原因</strong>
              <p>{order.cancellation_reason}</p>
            </div>
          )}
        </section>

        <section className="order-panel">
          <header><h2>关联试课</h2></header>
          <p className="order-panel__description">
            试课用于记录双方实际的试课安排和完成情况。
          </p>
          {order.trial_lessons?.length ? (
            <ul className="order-trial-list">
              {order.trial_lessons.map((trialLesson) => (
                <TrialLessonSummary key={trialLesson.id} trialLesson={trialLesson} />
              ))}
            </ul>
          ) : (
            <p className="order-panel__empty">暂无试课记录。</p>
          )}
          {role !== 'ADMIN' && (
            <Link className="order-inline-link" to={trialsPath}>前往试课页面</Link>
          )}
        </section>
      </div>

      {role !== 'ADMIN' && order.status !== 'CANCELLED' && (
        <section className="order-actions-panel">
          <div>
            <p className="eyebrow">订单流程</p>
            <h2>下一步操作</h2>
          </div>
          <div className="order-actions">
            {role === 'PARENT' && order.status === 'PENDING' && (
              <button className="primary-button" onClick={() => openDialog('terms')} type="button">
                确认服务金额
              </button>
            )}
            {role === 'STUDENT' && order.status === 'CONFIRMED' && (
              <button className="primary-button" onClick={() => openDialog('confirm')} type="button">
                确认订单并开始服务
              </button>
            )}
            {order.status === 'CONFIRMED' && role === 'PARENT' && (
              <span className="order-waiting-note">等待学生确认订单</span>
            )}
            {order.status === 'PENDING' && role === 'STUDENT' && (
              <span className="order-waiting-note">等待家长确认服务金额</span>
            )}
            {order.status === 'COMPLETED' && (
              <Link className="secondary-link-button" to={trialsPath}>查看试课</Link>
            )}
            {order.status === 'COMPLETED' && (
              <Link className="primary-link-button" to={reviewsPath}>
                {role === 'PARENT' ? '评价学生 / 查看评价' : '评价家长 / 查看评价'}
              </Link>
            )}
            {role === 'PARENT' && order.status === 'IN_PROGRESS' && (
              <button
                className="primary-button"
                disabled={!completionGuidance.canComplete}
                onClick={() => openDialog('complete')}
                type="button"
              >
                完成订单
              </button>
            )}
            {CANCELLABLE_STATUSES.has(order.status) && (
              <button className="danger-button" onClick={() => openDialog('cancel')} type="button">
                取消订单
              </button>
            )}
          </div>
          {role === 'PARENT' && order.status === 'IN_PROGRESS' && (
            <p className={`order-action-help ${completionGuidance.canComplete ? 'is-ready' : ''}`}>
              {completionGuidance.message}
            </p>
          )}
        </section>
      )}

      {role === 'ADMIN' && (
        <section className="order-actions-panel order-actions-panel--readonly">
          <div><p className="eyebrow">Admin view</p><h2>只读订单详情</h2></div>
          <p>当前管理页面不扩大操作范围。如需业务处理，请依据现有后台流程执行。</p>
        </section>
      )}

      <OrderActionDialog
        action={dialog}
        busy={submitting}
        error={actionError}
        onClose={() => !submitting && setDialog('')}
        onSubmit={submitAction}
        order={order}
      />
    </section>
  )
}

export default OrderDetailPage
